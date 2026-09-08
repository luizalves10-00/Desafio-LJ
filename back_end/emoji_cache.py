"""Fluent PNG cache: fixed upstream, validated Unicode, bounded persistent storage."""
from io import BytesIO
from contextlib import contextmanager
from pathlib import Path
import os
import re
import sqlite3
import time
import uuid
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import build_opener, HTTPRedirectHandler, Request

import emoji
from PIL import Image
from flask import Blueprint, jsonify, send_file

MAX_BYTES = 1024 * 1024
MAX_CACHE_BYTES = 200 * 1024 * 1024
MAX_DOWNLOADS_PER_MINUTE = 30


class CacheError(Exception):
    def __init__(self, status, retry=60):
        self.status, self.retry = status, retry


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_code(code):
    if not re.fullmatch(r'[0-9a-f]{2,6}(?:-[0-9a-f]{2,6}){0,19}', code):
        raise CacheError(400)
    try:
        character = ''.join(chr(int(part, 16)) for part in code.split('-'))
    except ValueError:
        raise CacheError(400) from None
    if not emoji.is_emoji(character):
        raise CacheError(400)
    normalized = character.replace('\ufe0f', '')
    key = '-'.join(f'{ord(c):x}' for c in normalized)
    return key, character


def download_png(character):
    # The client can supply neither a URL nor a host. Never follow redirects.
    url = f'https://www.emoji.family/api/emojis/{quote(character, safe="")}/fluent/png/256'
    req = Request(url, headers={'Accept': 'image/png', 'User-Agent': 'LevelUpStudy-EmojiCache/1.0'})
    with build_opener(NoRedirect).open(req, timeout=8) as response:
        if response.headers.get_content_type() != 'image/png':
            raise ValueError('Expected image/png')
        chunks, size, deadline = [], 0, time.monotonic() + 12
        while size <= MAX_BYTES:
            if time.monotonic() > deadline:
                raise TimeoutError('Download deadline exceeded')
            chunk = response.read1(min(65536, MAX_BYTES + 1 - size))
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
    return b''.join(chunks)


def sanitize_png(data):
    if len(data) > MAX_BYTES or not data.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Invalid PNG size/signature')
    with Image.open(BytesIO(data)) as source:
        if source.format != 'PNG' or not all(128 <= n <= 512 for n in source.size):
            raise ValueError('Invalid PNG dimensions')
        if getattr(source, 'n_frames', 1) != 1:
            raise ValueError('Animated images are not supported')
        source.verify()
    # Fully decode and encode again, discarding metadata and trailing payloads.
    with Image.open(BytesIO(data)) as source:
        output = BytesIO()
        source.convert('RGBA').save(output, format='PNG', optimize=True)
    result = output.getvalue()
    if len(result) > MAX_BYTES:
        raise ValueError('Encoded PNG too large')
    return result


class EmojiCache:
    def __init__(self, directory, bundled, fetcher=download_png):
        self.directory = Path(directory)
        self.bundled = Path(bundled)
        self.fetcher = fetcher
        self.directory.mkdir(parents=True, exist_ok=True)
        self.database = self.directory / 'cache.sqlite3'
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS entries (
                    key TEXT PRIMARY KEY, status INTEGER, retry_at REAL, size INTEGER DEFAULT 0);
                CREATE TABLE IF NOT EXISTS attempts (at REAL);
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value REAL);
            ''')

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.database, timeout=5)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def local(self, key):
        for directory in (self.bundled, self.directory):
            path = directory / f'{key}.png'
            if path.is_file():
                return path
        return None

    def resolve(self, code, authorize):
        key, character = validate_code(code)
        existing = self.local(key)
        if existing:
            return existing
        authorize()  # Authentication required only for a new outbound download.
        now = time.time()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            existing = self.local(key)
            if existing:
                return existing
            row = db.execute('SELECT status, retry_at FROM entries WHERE key=?', (key,)).fetchone()
            if row and row[1] > now:
                raise CacheError(row[0], max(1, int(row[1] - now)))
            cooldown = db.execute("SELECT value FROM settings WHERE key='cooldown'").fetchone()
            if cooldown and cooldown[0] > now:
                raise CacheError(503, max(1, int(cooldown[0] - now)))
            db.execute('DELETE FROM attempts WHERE at < ?', (now - 60,))
            if db.execute('SELECT count(*) FROM attempts').fetchone()[0] >= MAX_DOWNLOADS_PER_MINUTE:
                raise CacheError(429)
            if db.execute('SELECT count(*) FROM entries WHERE status=429 AND retry_at>?', (now,)).fetchone()[0] >= 2:
                raise CacheError(429, 2)
            if db.execute('SELECT coalesce(sum(size),0) FROM entries').fetchone()[0] + MAX_BYTES > MAX_CACHE_BYTES:
                raise CacheError(507, 3600)
            # Reservation deduplicates concurrent misses across Flask workers.
            db.execute('INSERT OR REPLACE INTO entries VALUES (?,429,?,0)', (key, now + 30))
            db.execute('INSERT INTO attempts VALUES (?)', (now,))
        try:
            data = self.fetcher(character)
            # Also validate injected/custom fetchers before writing to disk.
            data = sanitize_png(data)
            target = self.directory / f'{key}.png'
            temporary = self.directory / f'{key}.{uuid.uuid4().hex}.tmp'
            try:
                with self.connect() as db:
                    db.execute('BEGIN IMMEDIATE')
                    used = db.execute('SELECT coalesce(sum(size),0) FROM entries').fetchone()[0]
                    if used + len(data) > MAX_CACHE_BYTES:
                        raise CacheError(507, 3600)
                    temporary.write_bytes(data)
                    os.replace(temporary, target)
                    db.execute('INSERT OR REPLACE INTO entries VALUES (?,200,0,?)', (key, len(data)))
            finally:
                temporary.unlink(missing_ok=True)
            return target
        except Exception as error:
            status = 404 if isinstance(error, HTTPError) and error.code == 404 else 503
            retry = 86400 if status == 404 else 300
            if isinstance(error, CacheError):
                status, retry = error.status, error.retry
            with self.connect() as db:
                db.execute('INSERT OR REPLACE INTO entries VALUES (?,?,?,0)', (key, status, time.time() + retry))
                if status == 503:
                    db.execute("INSERT OR REPLACE INTO settings VALUES ('cooldown',?)", (time.time() + 60,))
            raise CacheError(status, retry) from None


def create_emoji_blueprint(cache, authorize):
    blueprint = Blueprint('emoji_images', __name__)

    @blueprint.get('/api/emoji/<code>.png')
    def image(code):
        try:
            path = cache.resolve(code, authorize)
            response = send_file(path, mimetype='image/png', conditional=True, max_age=31536000)
            response.headers['X-Content-Type-Options'] = 'nosniff'
            return response
        except CacheError as error:
            response = jsonify({'error': 'Emoji 3D indisponível; mantenha o emoji original.'})
            response.status_code = error.status
            response.headers['Cache-Control'] = 'no-store'
            response.headers['Retry-After'] = str(error.retry)
            return response

    return blueprint
