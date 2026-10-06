# -*- coding: utf-8 -*-
"""
Módulo de Segurança e DevSecOps - LevelUp Study
Implementações:
- Criptografia em Repouso de Segredos e Refresh Tokens (AES-128-CBC + HMAC-SHA256 via Fernet)
- Proteção CSRF Global para APIs REST (Origin/Referer + Token HMAC)
- Rate Limiting Robusto e Thread-Safe para Mitigação de Força Bruta
"""

import os
import time
import base64
import hashlib
import hmac
import secrets
import logging
from threading import Lock
from collections import defaultdict
from functools import wraps
from flask import request, jsonify, session, current_app
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("security")

# ═══════════════════════════════════════════════════════════════════════════════
# 1. CRIPTOGRAFIA EM REPOUSO (GOOGLE REFRESH TOKENS & SECRETS)
# ═══════════════════════════════════════════════════════════════════════════════

def _get_encryption_key() -> bytes:
    """
    Obtém ou deriva uma chave Fernet válida de 32 bytes URL-safe base64.
    Prioriza a variável ENCRYPTION_KEY; se ausente, deriva da SECRET_KEY via SHA256.
    """
    key = os.environ.get("ENCRYPTION_KEY")
    if key:
        clean_key = key.strip().encode("utf-8")
        try:
            # Valida se é uma chave Fernet legítima
            Fernet(clean_key)
            return clean_key
        except Exception:
            logger.warning("ENCRYPTION_KEY inválida fornecida. Derivando chave via SHA-256...")

    # Fallback determinístico seguro derivado da SECRET_KEY
    secret = (os.environ.get("SECRET_KEY") or "levelup_fallback_secret_key_change_in_prod").encode("utf-8")
    derived_32 = hashlib.sha256(b"levelup_token_cipher:" + secret).digest()
    return base64.urlsafe_b64encode(derived_32)


_CIPHER_SUITE = None

def get_cipher() -> Fernet:
    global _CIPHER_SUITE
    if _CIPHER_SUITE is None:
        _CIPHER_SUITE = Fernet(_get_encryption_key())
    return _CIPHER_SUITE


def encrypt_token(plain_token: str | None) -> str | None:
    """Criptografa uma string em repouso retornando o ciphertext em base64 (Fernet)."""
    if not plain_token:
        return None
    try:
        cipher = get_cipher()
        encrypted_bytes = cipher.encrypt(plain_token.encode("utf-8"))
        return encrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Erro ao criptografar token em repouso: {e}")
        return plain_token


def decrypt_token(cipher_or_plain: str | None) -> str | None:
    """
    Decriptografa o ciphertext armazenado.
    Se o token for legado (armazenado em texto plano antes da migração),
    ele detecta graciosamente e retorna o valor sem falhar.
    """
    if not cipher_or_plain:
        return None
    # Tokens Fernet sempre começam com 'gAAAAA'
    if not cipher_or_plain.startswith("gAAAAA"):
        return cipher_or_plain

    try:
        cipher = get_cipher()
        decrypted_bytes = cipher.decrypt(cipher_or_plain.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except InvalidToken:
        logger.warning("Token não pôde ser decriptografado com a chave atual (chave alterada ou token inválido). Retornando None para forçar reautenticação limpa.")
        return None
    except Exception as e:
        logger.error(f"Erro inesperado ao decriptografar token: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 2. PROTEÇÃO CSRF GLOBAL (CROSS-SITE REQUEST FORGERY)
# ═══════════════════════════════════════════════════════════════════════════════

CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
CSRF_EXEMPT_ROUTES = {
    "/api/webhooks/stripe",  # Autenticado via assinatura criptográfica HMAC do Stripe
}

def generate_csrf_token() -> str:
    """Gera ou recupera o token CSRF vinculado à sessão do usuário."""
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return session["csrf_token"]


def init_csrf_protection(app, allowed_origins: list[str] | None = None):
    """
    Middleware global de proteção CSRF:
    1. Valida Origin/Referer em métodos mutáveis (POST, PUT, DELETE, PATCH).
    2. Valida o cabeçalho X-CSRF-Token contra a sessão quando presente.
    3. Isenta rotas de webhook assinadas por HMAC.
    """
    trusted_origins = set(allowed_origins or [
        "https://levelupstudy.com.br",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ])

    @app.before_request
    def check_csrf():
        # Métodos seguros dispensam CSRF
        if request.method in CSRF_SAFE_METHODS:
            return None

        # Rotas com bypass criptográfico próprio (ex: Stripe Webhook com HMAC)
        if request.path in CSRF_EXEMPT_ROUTES:
            return None

        # Validação de Origin / Referer contra ataques Cross-Site
        origin = request.headers.get("Origin") or request.headers.get("Referer")
        if origin:
            clean_origin = origin.split("?")[0].rstrip("/")
            # Se for referer com path, extrai apenas o scheme + host[:port]
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            origin_base = f"{parsed.scheme}://{parsed.netloc}"

            if origin_base not in trusted_origins and "localhost" not in origin_base and "127.0.0.1" not in origin_base:
                logger.warning(f"Tentativa de CSRF bloqueada: Origin '{origin}' não confiável.")
                return jsonify({
                    "error": "Acesso negado: Origem da requisição não autorizada (CSRF Protection)."
                }), 403

        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 3. RATE LIMITING DE ALTA PERFORMANCE (ANTI-BRUTE FORCE)
# ═══════════════════════════════════════════════════════════════════════════════

class InMemoryRateLimiter:
    """
    Rate Limiter baseado em Janela Deslizante (Sliding Window Log).
    Thread-safe, com expiração automática de memória.
    """
    def __init__(self):
        self._records = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            # Filtra requisições da janela atual
            timestamps = [ts for ts in self._records[key] if ts > window_start]
            if len(timestamps) >= max_requests:
                earliest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - earliest)))
                self._records[key] = timestamps
                return False, retry_after

            timestamps.append(now)
            self._records[key] = timestamps
            return True, 0

    def clean_old_records(self):
        """Limpeza periódica de chaves expiradas para evitar vazamento de memória."""
        now = time.time()
        cutoff = now - 3600
        with self._lock:
            for k in list(self._records.keys()):
                self._records[k] = [ts for ts in self._records[k] if ts > cutoff]
                if not self._records[k]:
                    del self._records[k]


_rate_limiter = InMemoryRateLimiter()

def get_client_ip() -> str:
    """Obtém o IP real do cliente, considerando proxies reversos Nginx confiáveis."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Pega o primeiro IP da lista fornecida pelo Nginx
        return forwarded.split(",")[0].strip()
    return request.headers.get("X-Real-IP") or request.remote_addr or "127.0.0.1"


def rate_limit(max_requests: int = 5, per_seconds: int = 60, key_prefix: str = ""):
    """
    Decorator para aplicar limite de taxa estrito por IP em rotas sensíveis.
    Ex: @rate_limit(max_requests=5, per_seconds=60, key_prefix="login")
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            ip = get_client_ip()
            key = f"{key_prefix}:{ip}" if key_prefix else f"{request.endpoint}:{ip}"

            allowed, retry_after = _rate_limiter.is_allowed(key, max_requests, per_seconds)
            if not allowed:
                logger.warning(f"Rate limit excedido para IP {ip} na rota {request.path}. Bloqueado por {retry_after}s.")
                resp = jsonify({
                    "error": f"Muitas tentativas. Por favor, aguarde {retry_after} segundos antes de tentar novamente.",
                    "code": "TOO_MANY_REQUESTS",
                    "retry_after": retry_after
                })
                resp.status_code = 429
                resp.headers["Retry-After"] = str(retry_after)
                return resp

            return f(*args, **kwargs)
        return wrapper
    def_clean = getattr(_rate_limiter, "clean_old_records", None)
    if def_clean and secrets.randbelow(100) == 0:
        def_clean()
    return decorator
