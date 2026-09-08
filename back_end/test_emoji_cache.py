import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from threading import Event
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from flask import Flask
from PIL import Image
from emoji_cache import (EmojiCache, CacheError, NoRedirect,
                         create_emoji_blueprint, sanitize_png, validate_code)


def png(size=(256, 256)):
    output = BytesIO()
    Image.new('RGBA', size, (255, 0, 0, 255)).save(output, format='PNG')
    return output.getvalue()


class EmojiCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundled = self.root / 'bundled'
        self.bundled.mkdir()
        self.fetch = Mock(return_value=png())
        self.cache = EmojiCache(self.root / 'cache', self.bundled, self.fetch)
        self.authorize = Mock()

    def test_exact_sequences_and_invalid_inputs(self):
        self.assertEqual(validate_code('1f469-200d-1f680')[1], '👩‍🚀')
        self.assertEqual(validate_code('1f44b-1f3fd')[1], '👋🏽')
        self.assertEqual(validate_code('2764-fe0f')[0], '2764')
        self.assertEqual(validate_code('31-20e3')[1], '1⃣')
        for code in ('../secret', 'https://example.com', '61', '1f600-1f600', 'ffffff', '1f600-' * 30):
            with self.subTest(code=code), self.assertRaises(CacheError):
                self.cache.resolve(code, self.authorize)
        self.fetch.assert_not_called()

    def test_disk_cache_survives_new_instance(self):
        path = self.cache.resolve('1f44b', self.authorize)
        with Image.open(path) as image:
            self.assertEqual(image.size, (256, 256))
        fresh = EmojiCache(self.root / 'cache', self.bundled, self.fetch)
        self.assertEqual(fresh.resolve('1f44b', self.authorize), path)
        self.fetch.assert_called_once_with('👋')
        self.authorize.assert_called_once()
        self.assertFalse(list((self.root / 'cache').glob('*.tmp')))

    def test_bundled_does_not_use_network_or_auth(self):
        target = self.bundled / '1f345.png'
        target.write_bytes(png())
        self.assertEqual(self.cache.resolve('1f345', self.authorize), target)
        self.fetch.assert_not_called()
        self.authorize.assert_not_called()

    def test_auth_prevents_new_download(self):
        self.authorize.side_effect = CacheError(401)
        with self.assertRaises(CacheError) as caught:
            self.cache.resolve('1f44b', self.authorize)
        self.assertEqual(caught.exception.status, 401)
        self.fetch.assert_not_called()

    def test_missing_art_negative_cache_persists(self):
        self.fetch.side_effect = HTTPError('', 404, 'missing', {}, None)
        for service in (self.cache, EmojiCache(self.root / 'cache', self.bundled, self.fetch)):
            with self.assertRaises(CacheError) as caught:
                service.resolve('1f44b', self.authorize)
            self.assertEqual(caught.exception.status, 404)
        self.fetch.assert_called_once()

    def test_invalid_payload_and_dimensions(self):
        for data in (b'<html>error</html>', png((2048, 2048)), png()[:40], b'x' * (1024 * 1024 + 1)):
            with self.subTest(length=len(data)), self.assertRaises(Exception):
                sanitize_png(data)
        self.fetch.return_value = b'<html>error</html>'
        with self.assertRaises(CacheError):
            self.cache.resolve('1f44b', self.authorize)
        self.assertFalse(list((self.root / 'cache').glob('*.png')))

    def test_provider_failure_opens_cooldown(self):
        self.fetch.side_effect = TimeoutError()
        for code in ('1f44b', '1f64c'):
            with self.assertRaises(CacheError) as caught:
                self.cache.resolve(code, self.authorize)
            self.assertEqual(caught.exception.status, 503)
        self.fetch.assert_called_once()

    def test_rate_and_disk_limits(self):
        with patch('emoji_cache.MAX_DOWNLOADS_PER_MINUTE', 0):
            with self.assertRaises(CacheError) as caught:
                self.cache.resolve('1f44b', self.authorize)
            self.assertEqual(caught.exception.status, 429)
        with patch('emoji_cache.MAX_CACHE_BYTES', 0):
            with self.assertRaises(CacheError) as caught:
                self.cache.resolve('1f44b', self.authorize)
            self.assertEqual(caught.exception.status, 507)
        self.fetch.assert_not_called()

    def test_concurrent_misses_are_deduplicated(self):
        started, release = Event(), Event()
        def fetch(character):
            started.set()
            release.wait(5)
            return png()
        self.fetch.side_effect = fetch
        with ThreadPoolExecutor(2) as pool:
            first = pool.submit(self.cache.resolve, '1f44b', self.authorize)
            self.assertTrue(started.wait(5))
            try:
                with self.assertRaises(CacheError) as caught:
                    self.cache.resolve('1f44b', self.authorize)
                self.assertEqual(caught.exception.status, 429)
            finally:
                release.set()
            self.assertTrue(first.result().is_file())
        self.fetch.assert_called_once()

    def test_global_concurrent_limit(self):
        with self.cache.connect() as db:
            db.executemany('INSERT INTO entries VALUES (?,429,?,0)',
                           [('1f600', time.time() + 30), ('1f601', time.time() + 30)])
        with self.assertRaises(CacheError) as caught:
            self.cache.resolve('1f44b', self.authorize)
        self.assertEqual(caught.exception.status, 429)
        self.fetch.assert_not_called()

    def test_http_cache_headers_and_conditional_requests(self):
        app = Flask(__name__)
        app.register_blueprint(create_emoji_blueprint(self.cache, self.authorize))
        with app.test_client() as client:
            response = client.get('/api/emoji/1f44b.png')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
            self.assertIn('max-age=31536000', response.headers['Cache-Control'])
            cached = client.get('/api/emoji/1f44b.png', headers={'If-None-Match': response.headers['ETag']})
            self.assertEqual(cached.status_code, 304)
            response.close()
            cached.close()
            invalid = client.get('/api/emoji/61.png')
            self.assertEqual(invalid.status_code, 400)
            self.assertEqual(invalid.headers['Cache-Control'], 'no-store')

    def test_redirects_are_disabled(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, '', {}, 'http://127.0.0.1'))


if __name__ == '__main__':
    unittest.main()
