import os
import re
import json
import base64
import requests
import urllib.parse
from urllib.parse import quote_plus
import stripe
from functools import wraps
from flask import Flask, jsonify, request, session, send_from_directory, redirect
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime, timedelta
from google import genai
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from dotenv import load_dotenv
from emoji_cache import EmojiCache, CacheError, create_emoji_blueprint
import concurseiro_bank


# App setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "front_end")

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv(os.path.join(BASE_DIR, ".env"))

# ── App setup ──────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")

# Configuração da conexão com o Banco de Dados (MySQL via PyMySQL com suporte a variáveis de ambiente e fallback local)
use_sqlite = os.environ.get("USE_SQLITE", "").lower() in ("true", "1")

if use_sqlite:
    db_uri = f"sqlite:///{os.path.join(BASE_DIR, 'levelupstudy.db')}"
else:
    # Prioriza parâmetros individuais sanitizados e codificados (evita erro com caracteres especiais na senha ou URLs no host)
    db_user = os.environ.get("DB_USER")
    db_pass = os.environ.get("DB_PASS")
    db_host = os.environ.get("DB_HOST")

    if db_user and db_pass and db_host:
        clean_host = db_host.replace("https://", "").replace("http://", "").split("/")[0].strip()
        clean_port = os.environ.get("DB_PORT", "3306").strip() or "3306"
        clean_name = os.environ.get("DB_NAME", "LevelUp_db").strip()
        encoded_user = quote_plus(db_user.strip())
        encoded_pass = quote_plus(db_pass)
        db_uri = f"mysql+pymysql://{encoded_user}:{encoded_pass}@{clean_host}:{clean_port}/{clean_name}?charset=utf8mb4"
    else:
        db_uri = os.environ.get("DATABASE_URL")
        if not db_uri:
            # Fallback seguro para SQLite se nenhum MySQL foi especificado
            db_uri = f"sqlite:///{os.path.join(BASE_DIR, 'levelupstudy.db')}"

if db_uri.startswith("mysql://"):
    db_uri = db_uri.replace("mysql://", "mysql+pymysql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Opções de engine específicas para evitar desconexão no MySQL
if not db_uri.startswith("sqlite"):
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 280,
        "pool_pre_ping": True,
    }
else:
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
    }

app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

CORS(app, supports_credentials=True, origins=["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:8080", "http://127.0.0.1:8080", "null"])

db = SQLAlchemy(app)
migrate = Migrate(app, db)

# ── Constants ──────────────────────────────────────────────────────────────
XP_PER_POMODORO     = 50
XP_PER_TASK         = 30
# missões estilo RPG: quanto maior a prioridade, maior a recompensa
XP_PER_TASK_PRIORITY = {1: 40, 2: 30, 3: 20}
XP_PER_LEVEL        = 200
GAME_XP_MAX_PER_CALL = 50    # teto de XP por partida
GAME_XP_DAILY_CAP    = 150   # teto de XP de jogos por dia (anti-abuso)

# ── Planos & Permissões (Lean Canvas / Modelo de Negócio Freemium) ──────────
PLAN_CONFIG = {
    "free": {
        "id": "free",
        "name": "Aprendiz (Gratuito)",
        "price": 0.0,
        "price_formatted": "R$ 0",
        "description": "Acesso social gratuito para foco, tarefas e inclusão educacional.",
        "daily_ai_limit": 3,
        "concurseiro_daily_questions": 3,
        "unlimited_simulados": False,
        "advanced_analytics": False,
        "all_themes": False,
    },
    "hero_monthly": {
        "id": "hero_monthly",
        "name": "Herói / Concurseiro Pro (Mensal)",
        "price": 19.90,
        "price_formatted": "R$ 19,90 / mês",
        "description": "Acesso ilimitado com Mentor IA, Simulados e questões de concurso.",
        "daily_ai_limit": None,
        "concurseiro_daily_questions": None,
        "unlimited_simulados": True,
        "advanced_analytics": True,
        "all_themes": True,
    },
    "hero_yearly": {
        "id": "hero_yearly",
        "name": "Herói / Concurseiro Pro (Anual)",
        "price": 199.00,
        "price_formatted": "R$ 199,00 / ano",
        "description": "Plano anual com 7 dias de trial grátis e maior economia.",
        "daily_ai_limit": None,
        "concurseiro_daily_questions": None,
        "unlimited_simulados": True,
        "advanced_analytics": True,
        "all_themes": True,
    }
}

# Controle de taxa e cotas para usuários gratuitos (sustentabilidade do Canvas)
_daily_ai_usage = {}  # chave: (user_id, date_str) -> int

def get_ai_requests_today(user_id: int) -> int:
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    return _daily_ai_usage.get((user_id, today_str), 0)

def increment_ai_requests_today(user_id: int) -> int:
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    current = _daily_ai_usage.get((user_id, today_str), 0) + 1
    _daily_ai_usage[(user_id, today_str)] = current
    if len(_daily_ai_usage) > 10000:
        for k in list(_daily_ai_usage.keys()):
            if k[1] != today_str:
                _daily_ai_usage.pop(k, None)
    return current

# ── Models ─────────────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    interests     = db.Column(db.String(500), default="")
    
    # Controle de Acesso e Permissões (ACL)
    role          = db.Column(db.String(20), default="student", nullable=False)  # 'student', 'admin', 'superadmin'

    # Integração Financeira Stripe
    stripe_customer_id     = db.Column(db.String(120), unique=True, nullable=True, index=True)
    stripe_subscription_id = db.Column(db.String(120), unique=True, nullable=True, index=True)
    stripe_plan_id         = db.Column(db.String(100), nullable=True)
    subscription_status    = db.Column(db.String(50), default="free", nullable=True)  # 'free', 'trialing', 'active', 'past_due', 'canceled'
    current_period_end     = db.Column(db.DateTime, nullable=True)

    # Integração Google Calendar & OAuth 2.0
    google_access_token    = db.Column(db.Text, nullable=True)
    google_refresh_token   = db.Column(db.Text, nullable=True)
    google_token_expiry    = db.Column(db.DateTime, nullable=True)

    created_at    = db.Column(db.DateTime, default=datetime.utcnow)


    stats  = db.relationship("UserStats", back_populates="user", uselist=False, cascade="all, delete-orphan")
    tasks  = db.relationship("Task",      back_populates="user", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    @property
    def is_admin(self) -> bool:
        return self.role in ("admin", "superadmin")

    @property
    def is_premium(self) -> bool:
        if self.is_admin:
            return True
        if self.subscription_status in ("active", "trialing"):
            if self.current_period_end:
                return self.current_period_end >= datetime.utcnow()
            return True
        return False

    @property
    def plan_name(self) -> str:
        if self.is_admin:
            return "Super Admin (Acesso Total)" if self.role == "superadmin" else "Administrador"
        if self.is_premium:
            plan_id = (self.stripe_plan_id or "").lower()
            try:
                sub_plan = SubscriptionPlan.query.filter(
                    db.or_(SubscriptionPlan.stripe_price_id == self.stripe_plan_id, SubscriptionPlan.plan_key == plan_id)
                ).first()
                if sub_plan:
                    return sub_plan.name
            except Exception:
                pass
            if "year" in plan_id or "anual" in plan_id:
                return "Herói / Concurseiro Pro (Anual)"
            elif self.stripe_plan_id:
                return "Herói / Concurseiro Pro (Mensal)"
            return "Herói / Concurseiro Pro (Bypass)"
        return "Aprendiz (Gratuito)"

    def get_permissions(self) -> dict:
        is_pro = self.is_premium
        ai_used = get_ai_requests_today(self.id)
        
        plan_perms = {}
        if is_pro and self.stripe_plan_id:
            try:
                sub_plan = SubscriptionPlan.query.filter(
                    db.or_(SubscriptionPlan.stripe_price_id == self.stripe_plan_id, SubscriptionPlan.plan_key == self.stripe_plan_id.lower())
                ).first()
                if sub_plan:
                    plan_perms = sub_plan.get_permissions()
            except Exception:
                pass

        unlimited_ai = plan_perms.get("can_access_unlimited_ai", is_pro)
        daily_limit = plan_perms.get("daily_ai_limit") if not unlimited_ai else None
        if not is_pro:
            daily_limit = 3

        return {
            "is_premium": is_pro,
            "role": self.role,
            "plan_name": self.plan_name,
            "subscription_status": self.subscription_status or "free",
            "current_period_end": self.current_period_end.isoformat() if self.current_period_end else None,
            "can_access_unlimited_ai": unlimited_ai,
            "can_access_concurseiro_pro": is_pro,
            "can_access_advanced_analytics": plan_perms.get("can_access_advanced_analytics", is_pro),
            "can_access_all_themes": plan_perms.get("can_access_all_themes", is_pro),
            "ai_commented_answers": plan_perms.get("ai_commented_answers", is_pro),
            "priority_support": plan_perms.get("priority_support", False),
            "offline_downloads": plan_perms.get("offline_downloads", False),
            "daily_ai_limit": daily_limit,
            "ai_requests_today": ai_used,
            "ai_requests_remaining": None if unlimited_ai else max(0, (daily_limit or 3) - ai_used),
            "concurseiro_simulados": "unlimited" if plan_perms.get("concurseiro_simulados", is_pro) else "preview_only (3 questões)"
        }

    def to_public(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "interests": self.interests,
            "role": self.role,
            "is_admin": self.is_admin,
            "is_premium": self.is_premium,
            "plan_name": self.plan_name,
            "subscription_status": self.subscription_status,
            "current_period_end": self.current_period_end.isoformat() if self.current_period_end else None,
            "google_calendar_connected": bool(self.google_access_token or self.google_refresh_token),
            "permissions": self.get_permissions()
        }



class UserStats(db.Model):
    __tablename__ = "user_stats"

    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    xp               = db.Column(db.Integer, default=0)
    streak           = db.Column(db.Integer, default=0)
    last_study_date  = db.Column(db.String(10), nullable=True)
    total_pomodoros  = db.Column(db.Integer, default=0)
    game_xp_today    = db.Column(db.Integer, default=0)
    game_xp_date     = db.Column(db.String(10), nullable=True)

    user = db.relationship("User", back_populates="stats")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    @property
    def level(self) -> int:
        return max(1, self.xp // XP_PER_LEVEL + 1)

    @property
    def xp_to_next(self) -> int:
        return self.level * XP_PER_LEVEL - self.xp

    @property
    def xp_progress_pct(self) -> int:
        return int((self.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100)

    def to_dict(self) -> dict:
        return {
            "xp":              self.xp,
            "level":           self.level,
            "streak":          self.streak,
            "last_study_date": self.last_study_date,
            "total_pomodoros": self.total_pomodoros,
            "xp_to_next":      self.xp_to_next,
            "xp_progress_pct": self.xp_progress_pct,
        }


class Task(db.Model):
    __tablename__ = "tasks"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title      = db.Column(db.String(200), nullable=False)
    subject    = db.Column(db.String(100), default="")
    due_date   = db.Column(db.String(10), default="")
    priority   = db.Column(db.Integer, default=2)
    done       = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="tasks")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self) -> dict:
        return {
            "id":       self.id,
            "title":    self.title,
            "subject":  self.subject,
            "due_date": self.due_date,
            "priority": self.priority,
            "done":     self.done,
        }


class SimuladoHistory(db.Model):
    __tablename__ = "simulado_history"

    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    subject         = db.Column(db.String(100), default="Geral")
    total_questions = db.Column(db.Integer, default=0)
    correct_count   = db.Column(db.Integer, default=0)
    accuracy_pct    = db.Column(db.Float, default=0.0)
    xp_awarded      = db.Column(db.Integer, default=0)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "subject": self.subject,
            "total_questions": self.total_questions,
            "correct_count": self.correct_count,
            "accuracy_pct": self.accuracy_pct,
            "xp_awarded": self.xp_awarded,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ── Catálogo de Permissões dos Planos ──────────────────────────────────────
AVAILABLE_PERMISSIONS = [
    {
        "key": "can_access_unlimited_ai",
        "name": "Mentor IA Gemini Ilimitado",
        "description": "Perguntas e orientações ilimitadas com o tutor de IA Gemini 2.5",
        "default": True,
        "icon": "🤖"
    },
    {
        "key": "concurseiro_simulados",
        "name": "Simulados Cronometrados Ilimitados",
        "description": "Simulados completos por banca oficial (Cebraspe, FGV, FCC, Vunesp)",
        "default": True,
        "icon": "⏱️"
    },
    {
        "key": "ai_commented_answers",
        "name": "Gabaritos e Análise de Erros com IA",
        "description": "Comentários pedagógicos e fundamentação jurídica questão por questão",
        "default": True,
        "icon": "💡"
    },
    {
        "key": "can_access_all_themes",
        "name": "Todos os Temas RPG Desbloqueados",
        "description": "Acesso livre a todos os 6 temas e skins da interface (raros e lendários)",
        "default": True,
        "icon": "🎨"
    },
    {
        "key": "can_access_advanced_analytics",
        "name": "Painel de Métricas Avançadas",
        "description": "Gráficos de evolução, mapas de calor e análise de pontos fracos",
        "default": True,
        "icon": "📊"
    },
    {
        "key": "priority_support",
        "name": "Suporte Prioritário Pedagógico",
        "description": "Atendimento preferencial com especialistas em concursos",
        "default": False,
        "icon": "⭐"
    },
    {
        "key": "offline_downloads",
        "name": "Cadernos de Questões em PDF",
        "description": "Download e impressão de simulados e cadernos para estudo offline",
        "default": False,
        "icon": "📥"
    }
]


class SubscriptionPlan(db.Model):
    __tablename__ = "subscription_plans"

    id                = db.Column(db.Integer, primary_key=True)
    plan_key          = db.Column(db.String(60), unique=True, nullable=False, index=True)
    name              = db.Column(db.String(120), nullable=False)
    description       = db.Column(db.Text, default="")
    price_amount      = db.Column(db.Float, nullable=False)
    currency          = db.Column(db.String(10), default="brl")
    interval          = db.Column(db.String(20), default="month")
    interval_count    = db.Column(db.Integer, default=1)
    trial_days        = db.Column(db.Integer, default=7)
    badge             = db.Column(db.String(60), default="")
    emoji             = db.Column(db.String(30), default="🛡️")
    is_active         = db.Column(db.Boolean, default=True)

    stripe_product_id = db.Column(db.String(120), nullable=True)
    stripe_price_id   = db.Column(db.String(120), nullable=True)
    permissions_json  = db.Column(db.Text, default="{}")
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)

    def get_permissions(self) -> dict:
        try:
            return json.loads(self.permissions_json or "{}")
        except Exception:
            return {}

    def set_permissions(self, perms: dict):
        self.permissions_json = json.dumps(perms, ensure_ascii=False)

    def to_dict(self) -> dict:
        label = "Mensal"
        if self.interval == "year" and self.interval_count == 1:
            label = "Anual"
        elif self.interval == "month" and self.interval_count == 6:
            label = "Semestral"
        elif self.interval == "month" and self.interval_count == 3:
            label = "Trimestral"
        elif self.interval == "month" and self.interval_count > 1:
            label = f"{self.interval_count} Meses"

        return {
            "id": self.id,
            "plan_key": self.plan_key,
            "name": self.name,
            "description": self.description or "",
            "price_amount": self.price_amount,
            "price_brl": self.price_amount,
            "formatted_price": f"R$ {self.price_amount:.2f}".replace(".", ","),
            "price_formatted": f"R$ {self.price_amount:.2f}".replace(".", ","),
            "currency": self.currency,
            "interval": self.interval,
            "interval_count": self.interval_count,
            "interval_label": label,
            "trial_days": self.trial_days,
            "badge": self.badge or "",
            "emoji": self.emoji or "🛡️",
            "is_active": self.is_active,
            "stripe_product_id": self.stripe_product_id or "",
            "stripe_price_id": self.stripe_price_id or "",
            "is_synced_stripe": bool(self.stripe_price_id and str(self.stripe_price_id).startswith("price_")),
            "permissions": self.get_permissions(),
            "created_at": self.created_at.strftime("%d/%m/%Y %H:%M") if self.created_at else None,
        }


# ── Helpers ────────────────────────────────────────────────────────────────
def current_user() -> User | None:
    uid = session.get("user_id")
    return db.session.get(User, uid) if uid else None


def require_auth():
    user = current_user()
    if not user:
        return jsonify({"error": "Não autenticado"}), 401
    return user


def require_role(*roles):
    """
    Decorator para proteger rotas da API com base no papel/role do usuário.
    Exemplo:
        @app.route("/api/admin/metrics")
        @require_role("admin", "superadmin")
        def admin_metrics():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Não autenticado"}), 401
            if user.role not in roles:
                return jsonify({
                    "error": "Acesso negado: permissão insuficiente.",
                    "required_roles": list(roles),
                    "current_role": user.role
                }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_premium(feature_name="este recurso"):
    """
    Decorator para proteger rotas da API exclusivas do Plano Herói / Concurseiro Pro.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Não autenticado"}), 401
            if not user.is_premium:
                return jsonify({
                    "error": f"O acesso a {feature_name} é exclusivo do Plano Herói / Concurseiro Pro.",
                    "code": "UPGRADE_REQUIRED",
                    "plan_required": "hero_pro",
                    "trial_available": True,
                    "pricing": {
                        "monthly": "R$ 19,90/mês",
                        "yearly": "R$ 199,00/ano (com 7 dias de trial grátis)"
                    }
                }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_or_create_stats(user: User) -> UserStats:
    if not user.stats:
        stats = UserStats(user_id=user.id)
        db.session.add(stats)
        db.session.commit()
    return user.stats


# ── Auth routes ────────────────────────────────────────────────────────────
@app.route("/api/auth/register", methods=["POST"])
def register():
    body = request.get_json(silent=True) or {}
    name      = (body.get("name") or "").strip()
    email     = (body.get("email") or "").strip().lower()
    password  = body.get("password") or ""
    interests = (body.get("interests") or "").strip()

    if not name or not email or not password:
        return jsonify({"error": "Nome, e-mail e senha são obrigatórios"}), 400
    if len(password) < 6:
        return jsonify({"error": "A senha deve ter pelo menos 6 caracteres"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "E-mail já cadastrado"}), 409

    user = User(name=name, email=email, interests=interests)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    stats = UserStats(user_id=user.id)
    db.session.add(stats)
    db.session.commit()

    session["user_id"] = user.id
    return jsonify({
        "user": user.to_public(),
        "stats": stats.to_dict(),
        "redirect_to": "index.html"
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "E-mail ou senha incorretos"}), 401

    session["user_id"] = user.id
    stats = get_or_create_stats(user)
    default_redirect = "admin.html" if user.is_admin else "index.html"
    return jsonify({
        "user": user.to_public(),
        "stats": stats.to_dict(),
        "redirect_to": default_redirect
    })


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"ok": True})


@app.route("/api/auth/me", methods=["GET"])
def me():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result
    stats = get_or_create_stats(user)
    return jsonify({"user": user.to_public(), "stats": stats.to_dict()})


# ── Status ─────────────────────────────────────────────────────────────────
@app.route("/api/status", methods=["GET"])
def get_status():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    stats = get_or_create_stats(result)
    data = stats.to_dict()
    data["tasks_done"] = Task.query.filter_by(user_id=result.id, done=True).count()
    return jsonify(data)


# ── Pomodoro ───────────────────────────────────────────────────────────────
@app.route("/api/pomodoro/complete", methods=["POST"])
def complete_pomodoro():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user  = result
    stats = get_or_create_stats(user)
    today = str(date.today())

    yesterday = str(date.fromordinal(date.today().toordinal() - 1))
    if stats.last_study_date == today:
        pass
    elif stats.last_study_date == yesterday:
        stats.streak += 1
    else:
        stats.streak = 1

    stats.last_study_date = today
    stats.total_pomodoros += 1
    stats.xp += XP_PER_POMODORO
    db.session.commit()

    return jsonify({
        "xp_gained":      XP_PER_POMODORO,
        "total_xp":       stats.xp,
        "level":          stats.level,
        "streak":         stats.streak,
        "xp_to_next":     stats.xp_to_next,
        "xp_progress_pct": stats.xp_progress_pct,
    })


# ── Recompensa de jogos ─────────────────────────────────────────────────────
@app.route("/api/game/reward", methods=["POST"])
def game_reward():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user  = result
    stats = get_or_create_stats(user)
    body  = request.get_json(silent=True) or {}

    amount = int(body.get("amount", 0) or 0)
    amount = max(0, min(amount, GAME_XP_MAX_PER_CALL))

    today = str(date.today())
    if stats.game_xp_date != today:
        stats.game_xp_date = today
        stats.game_xp_today = 0

    remaining = max(0, GAME_XP_DAILY_CAP - (stats.game_xp_today or 0))
    granted   = min(amount, remaining)

    stats.xp += granted
    stats.game_xp_today = (stats.game_xp_today or 0) + granted
    db.session.commit()

    return jsonify({
        "xp_gained":       granted,
        "capped":          granted < amount,
        "daily_remaining": max(0, GAME_XP_DAILY_CAP - stats.game_xp_today),
        "total_xp":        stats.xp,
        "level":           stats.level,
        "xp_to_next":      stats.xp_to_next,
        "xp_progress_pct": stats.xp_progress_pct,
    })


# ── Tasks ──────────────────────────────────────────────────────────────────
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result
    tasks = (
        Task.query
        .filter_by(user_id=user.id)
        .order_by(Task.done.asc(), Task.priority.asc(), Task.due_date.asc())
        .all()
    )
    return jsonify([t.to_dict() for t in tasks])


@app.route("/api/tasks", methods=["POST"])
def add_task():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Título obrigatório"}), 400

    task = Task(
        user_id  = user.id,
        title    = title,
        subject  = (body.get("subject") or "").strip(),
        due_date = (body.get("due_date") or "").strip(),
        priority = int(body.get("priority") or 2),
    )
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201


@app.route("/api/tasks/<int:task_id>/complete", methods=["POST"])
def complete_task(task_id: int):
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user  = result
    task  = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not task or task.done:
        return jsonify({"error": "Tarefa não encontrada ou já concluída"}), 404

    task.done = True
    stats = get_or_create_stats(user)
    xp_gained = XP_PER_TASK_PRIORITY.get(task.priority, XP_PER_TASK)
    stats.xp += xp_gained
    db.session.commit()

    return jsonify({
        "xp_gained":      xp_gained,
        "total_xp":       stats.xp,
        "level":          stats.level,
        "xp_progress_pct": stats.xp_progress_pct,
    })


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id: int):
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result
    task = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if task:
        db.session.delete(task)
        db.session.commit()
    return jsonify({"ok": True})


# ── Google Calendar & OAuth 2.0 (Fase 5) ──────────────────────────────────
def sync_study_plan_to_google_calendar(user_id: int, plan_tasks=None) -> dict:
    """
    Recebe um 'Plano de Estudo' do banco de dados e itera inserindo eventos via 
    google-api-python-client na agenda primária do usuário.
    
    Os eventos criados DEVEM conter a propriedade reminders configurada para 
    disparar alertas nativos no celular do aluno (ex: {'useDefault': False, 'overrides': [{'method': 'popup', 'minutes': 15}]}).
    """
    user = db.session.get(User, user_id)
    if not user:
        raise ValueError("Usuário não encontrado.")
    
    if not user.google_access_token and not user.google_refresh_token:
        raise ValueError("Conta Google não conectada. Conecte sua conta Google antes de sincronizar.")

    client_id = os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET") or os.environ.get("CLIENT_SECRET")

    # Monta as credenciais OAuth 2.0 usando a biblioteca oficial google-auth
    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=[
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/calendar"
        ]
    )

    # Renova token se estiver expirado ou sem access_token atual
    if (not creds.valid or creds.expired) and creds.refresh_token:
        try:
            creds.refresh(Request())
            user.google_access_token = creds.token
            if creds.expiry:
                user.google_token_expiry = creds.expiry
            db.session.commit()
        except Exception as refresh_err:
            app.logger.error(f"Erro ao renovar token OAuth do Google: {refresh_err}")
            raise ValueError(f"Não foi possível renovar o acesso à sua conta Google: {refresh_err}")

    # Cria o client oficial da API do Google Calendar v3
    service = build("calendar", "v3", credentials=creds)

    # Busca o Plano de Estudo do banco de dados (Tarefas de estudo pendentes do usuário)
    if plan_tasks is None:
        plan_tasks = Task.query.filter_by(user_id=user.id, done=False).order_by(Task.priority.asc(), Task.due_date.asc()).all()

    if not plan_tasks:
        return {
            "success": True,
            "synced_count": 0,
            "total_tasks": 0,
            "message": "Nenhuma meta de estudo pendente no momento para sincronizar.",
            "events": []
        }

    created_events = []
    base_time = datetime.now()

    for idx, task in enumerate(plan_tasks):
        due_date_str = getattr(task, "due_date", None)
        title = getattr(task, "title", "Sessão de Estudos")
        subject = getattr(task, "subject", "Geral") or "Geral"
        priority = getattr(task, "priority", 2)
        priority_label = {1: "⚡ Alta Prioridade (Chefe)", 2: "🛡️ Média Prioridade (Elite)", 3: "🗡️ Normal"}.get(priority, "📌 Meta")

        # Define data e horário da sessão de estudos
        start_dt = None
        if due_date_str:
            try:
                parsed_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
                event_hour = 9 + (idx % 6)
                start_dt = datetime.combine(parsed_date, datetime.min.time()).replace(hour=event_hour, minute=0, second=0)
            except Exception:
                start_dt = None

        if not start_dt or start_dt < base_time:
            # Distribui tarefas a partir de hoje/amanhã nos horários de estudo
            days_offset = idx // 3
            hour_slot = 9 + ((idx % 3) * 2)
            start_dt = (base_time + timedelta(days=days_offset)).replace(hour=hour_slot, minute=0, second=0, microsecond=0)
            if start_dt < base_time:
                start_dt = (base_time + timedelta(days=1)).replace(hour=hour_slot, minute=0, second=0, microsecond=0)

        end_dt = start_dt + timedelta(minutes=50) # Sessão padrão de 50 min de foco

        # Formata o evento com lembretes nativos (pop-up para smartphone/desktop)
        event_body = {
            "summary": f"⚔️ [LevelUp Study] {title} ({subject})",
            "description": (
                f"🎯 Meta de Estudo — LevelUp Study\n"
                f"📚 Disciplina: {subject}\n"
                f"🏷️ Nível: {priority_label}\n\n"
                f"⚡ Inicie o Pomodoro no aplicativo para derrotar monstros, ganhar XP e manter seu Streak diário ativo!\n"
                f"🔗 Acesse sua jornada: http://127.0.0.1:5000/index.html"
            ),
            "start": {
                "dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "America/Sao_Paulo",
            },
            "end": {
                "dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "America/Sao_Paulo",
            },
            # Configuração mandatória de lembretes para alertas nativos no celular
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 15},
                    {"method": "email", "minutes": 60}
                ]
            },
            "colorId": "11" if priority == 1 else "5"
        }

        try:
            created = service.events().insert(calendarId="primary", body=event_body).execute()
            created_events.append({
                "id": created.get("id"),
                "summary": created.get("summary"),
                "htmlLink": created.get("htmlLink"),
                "start": start_dt.isoformat()
            })
        except Exception as ins_err:
            app.logger.warning(f"Erro ao inserir evento '{title}' no Google Calendar: {ins_err}")

    return {
        "success": True,
        "synced_count": len(created_events),
        "total_tasks": len(plan_tasks),
        "events": created_events,
        "message": f"{len(created_events)} missão(ões) de estudo sincronizada(s) com sucesso na sua Google Agenda com alertas de 15 minutos!"
    }


@app.route("/api/google/login", methods=["GET"])
def google_login():
    """
    Inicia o fluxo OAuth 2.0 para autorizar o acesso à Google Calendar API.
    Suporta tanto requisições do frontend (retornando auth_url JSON) quanto navegação direta (redirecionamento 302).
    """
    user = current_user()
    if not user:
        if request.args.get("json") == "true" or request.headers.get("Accept") == "application/json":
            return jsonify({"error": "Não autenticado. Faça login no LevelUp Study primeiro."}), 401
        return redirect("/login.html?redirect=/api/google/login")

    client_id = os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET") or os.environ.get("CLIENT_SECRET")
    
    if not client_id or not client_secret:
        return jsonify({"error": "Credenciais do Google Calendar (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) não configuradas no servidor."}), 500

    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI")
    if not redirect_uri:
        redirect_uri = request.url_root.rstrip("/") + "/api/google/callback"

    # Cria estado com user_id
    state_payload = {
        "user_id": user.id,
        "nonce": os.urandom(8).hex(),
        "created_at": int(datetime.utcnow().timestamp())
    }
    state_b64 = base64.urlsafe_b64encode(json.dumps(state_payload).encode()).decode()
    session["google_oauth_state"] = state_b64

    scopes = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar"
    ]
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "prompt": "consent",
        "state": state_b64
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    if request.args.get("json") == "true" or request.headers.get("Accept") == "application/json":
        return jsonify({"auth_url": auth_url, "redirect_uri": redirect_uri})
    
    return redirect(auth_url)


@app.route("/api/google/callback", methods=["GET"])
def google_callback():
    """
    Recebe o código de autorização do Google após o consentimento do aluno,
    troca pelo access_token e refresh_token, e persiste no banco de dados.
    """
    error = request.args.get("error")
    if error:
        app.logger.warning(f"Google OAuth cancelado ou com erro: {error}")
        return redirect(f"/index.html?calendar_error={urllib.parse.quote(error)}")

    code = request.args.get("code")
    state_b64 = request.args.get("state")
    if not code:
        return redirect("/index.html?calendar_error=missing_code")

    user = current_user()
    if not user and state_b64:
        try:
            state_json = base64.urlsafe_b64decode(state_b64.encode()).decode()
            state_data = json.loads(state_json)
            uid = state_data.get("user_id")
            if uid:
                user = db.session.get(User, uid)
                if user:
                    session["user_id"] = user.id
        except Exception as state_err:
            app.logger.warning(f"Erro ao decodificar state OAuth: {state_err}")

    if not user:
        return redirect("/login.html?error=session_expired")

    client_id = os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET") or os.environ.get("CLIENT_SECRET")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI") or (request.url_root.rstrip("/") + "/api/google/callback")

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }

    try:
        resp = requests.post(token_url, data=payload, timeout=20)
        token_data = resp.json()
    except Exception as net_err:
        app.logger.error(f"Erro de conexão com OAuth Google: {net_err}")
        return redirect("/index.html?calendar_error=google_connection_failed")

    if "error" in token_data:
        err_msg = token_data.get("error_description", token_data.get("error"))
        app.logger.error(f"Erro retornado pelo Google OAuth: {err_msg}")
        return redirect(f"/index.html?calendar_error={urllib.parse.quote(str(err_msg))}")

    user.google_access_token = token_data.get("access_token")
    if token_data.get("refresh_token"):
        user.google_refresh_token = token_data.get("refresh_token")
    
    expires_in = token_data.get("expires_in", 3600)
    user.google_token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
    db.session.commit()

    return redirect("/index.html?calendar_status=connected")


@app.route("/api/google/status", methods=["GET"])
def google_status():
    """Retorna o status atual da integração com o Google Calendar para o aluno logado."""
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    is_connected = bool(user.google_access_token or user.google_refresh_token)
    return jsonify({
        "connected": is_connected,
        "token_expiry": user.google_token_expiry.isoformat() if user.google_token_expiry else None
    })


@app.route("/api/google/sync-calendar", methods=["POST"])
def google_sync_calendar():
    """
    Dispara a sincronização das metas de estudo do aluno com a sua Google Agenda primária.
    """
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    try:
        res = sync_study_plan_to_google_calendar(user.id)
        return jsonify(res)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Erro ao sincronizar tarefas com Google Calendar: {e}")
        return jsonify({"error": f"Erro interno ao sincronizar com Google Agenda: {str(e)}"}), 500


@app.route("/api/google/disconnect", methods=["POST"])
def google_disconnect():
    """Desconecta a conta do Google Calendar do aluno."""
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    user.google_access_token = None
    user.google_refresh_token = None
    user.google_token_expiry = None
    db.session.commit()

    return jsonify({"success": True, "message": "Conta do Google Agenda desconectada com sucesso."})


# ── Suggest ────────────────────────────────────────────────────────────────
@app.route("/api/suggest", methods=["GET"])
def suggest():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user    = result
    pending = Task.query.filter_by(user_id=user.id, done=False).all()

    if not pending:
        return jsonify({"suggestion": None, "message": "Nenhuma tarefa pendente! Adicione novas tarefas."})

    best = sorted(pending, key=lambda t: (t.due_date or "9999-12-31", t.priority))[0]
    return jsonify({"suggestion": best.to_dict(), "message": f"Comece por: {best.title}"})


# ── AI Routine Planner ─────────────────────────────────────────────────────
@app.route("/api/ai/routine", methods=["GET"])
def ai_routine():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "Chave da API do Gemini (GEMINI_API_KEY) não configurada no servidor."}), 500
        
    stats = get_or_create_stats(user)
    pending_tasks = Task.query.filter_by(user_id=user.id, done=False).all()
    
    if not pending_tasks:
        return jsonify({"suggestion": "Você não tem tarefas pendentes! Adicione novas tarefas para que eu possa organizar sua rotina.", "type": "empty"})

    task_list_str = "\n".join([f"- {t.title} (Prioridade: {t.priority}, Prazo: {t.due_date or 'Sem prazo'})" for t in pending_tasks])
    
    prompt = f"""
Você é um assistente de estudos motivacional e prático do aplicativo LevelUp Study.
O usuário se chama {user.name}. Ele está no Nível {stats.level} e tem um streak (dias seguidos de estudo) de {stats.streak} dias.
Interesses do usuário: {user.interests or 'Não definidos'}. Use esses interesses como contexto em suas dicas e sugestões se possível.

Aqui estão as tarefas pendentes dele:
{task_list_str}

Crie um plano de estudos curto e direto para o dia de hoje.
Regras:
1. Comece com uma frase motivacional curta e energética.
2. Sugira qual tarefa ele deve fazer primeiro e como ele deve seguir (priorizando prazos curtos e maior prioridade, onde prioridade 1 é máxima).
3. Seja conciso (máximo de 3 parágrafos curtos). Use emojis para deixar o texto moderno e amigável.
4. Lembre-o de usar o timer Pomodoro do app para ganhar XP.
"""

    if not user.is_premium:
        used_today = get_ai_requests_today(user.id)
        if used_today >= PLAN_CONFIG["free"]["daily_ai_limit"]:
            return jsonify({
                "error": "Você atingiu o limite de 3 consultas diárias com a IA do Plano Aprendiz (Gratuito). Assine o Plano Herói / Concurseiro Pro para ter acesso ilimitado!",
                "code": "PLAN_LIMIT_REACHED",
                "plan": "free",
                "daily_limit": 3,
                "used_today": used_today,
                "trial_available": True
            }), 403

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        if not user.is_premium:
            increment_ai_requests_today(user.id)
        remaining = None if user.is_premium else max(0, 3 - get_ai_requests_today(user.id))
        return jsonify({
            "suggestion": response.text,
            "type": "ai",
            "plan": "hero_pro" if user.is_premium else "free",
            "ai_requests_remaining": remaining
        })
    except Exception as e:
        print(f"Erro na API do Gemini: {e}")
        return jsonify({"error": "Erro ao comunicar com a inteligência artificial."}), 500

@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result
    
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Mensagem vazia."}), 400
        
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "Chave da API do Gemini (GEMINI_API_KEY) não configurada no servidor."}), 500
        
    # Verificação de cota do Plano Aprendiz (Free) conforme o Modelo do Canvas
    if not user.is_premium:
        used_today = get_ai_requests_today(user.id)
        if used_today >= PLAN_CONFIG["free"]["daily_ai_limit"]:
            return jsonify({
                "error": "Você atingiu o limite de 3 consultas diárias com o Mentor IA do Plano Aprendiz (Gratuito). Assine o Plano Herói / Concurseiro Pro com 7 dias grátis para perguntas ilimitadas!",
                "code": "PLAN_LIMIT_REACHED",
                "plan": "free",
                "daily_limit": 3,
                "used_today": used_today,
                "trial_available": True
            }), 403

    stats = get_or_create_stats(user)
    
    prompt = f"""
Você é um mentor de estudos de IA, parte de um app de produtividade gamificado (LevelUp Study).
O nome do usuário é {user.name}, Nível {stats.level}, Streak {stats.streak} dias.
Interesses do usuário: {user.interests or 'Não definidos'}.
IMPORTANTE: Use esses interesses como foco temático para analogias, exemplos práticos e explicações (ex: se ele gosta de futebol e estuda física, use chutes de jogadores famosos para explicar; se ele gosta de anime, use poderes de personagens). 

Mensagem do usuário: "{message}"

Responda de forma direta, amigável e encorajadora. Você pode usar formatação Markdown simples. Tente manter a resposta curta (1-3 parágrafos) a menos que ele peça algo complexo.
"""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        if not user.is_premium:
            increment_ai_requests_today(user.id)
        remaining = None if user.is_premium else max(0, 3 - get_ai_requests_today(user.id))
        return jsonify({
            "reply": response.text,
            "plan": "hero_pro" if user.is_premium else "free",
            "ai_requests_remaining": remaining
        })
    except Exception as e:
        print(f"Erro na API do Gemini: {e}")
        return jsonify({"error": "Erro ao comunicar com a inteligência artificial."}), 500


# ── Stripe & Pagamentos (Assinaturas Concurseiros) ─────────────────────────
def find_user_from_stripe_data(customer_id=None, subscription_id=None, user_id=None, email=None) -> User | None:
    """Localiza o usuário de forma resiliente usando qualquer identificador disponível."""
    if user_id:
        try:
            u = db.session.get(User, int(user_id))
            if u:
                return u
        except (ValueError, TypeError):
            pass

    if subscription_id:
        u = User.query.filter_by(stripe_subscription_id=subscription_id).first()
        if u:
            return u

    if customer_id:
        u = User.query.filter_by(stripe_customer_id=customer_id).first()
        if u:
            return u

    if email:
        u = User.query.filter_by(email=email.lower().strip()).first()
        if u:
            return u

    return None


@app.route("/api/stripe/config", methods=["GET"])
def stripe_config():
    """Retorna chaves públicas e identificadores de planos para o frontend."""
    return jsonify({
        "publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY", ""),
        "plans": {
            "monthly": bool(os.environ.get("STRIPE_PRICE_MONTHLY")),
            "yearly": bool(os.environ.get("STRIPE_PRICE_YEARLY")),
        },
        "trial_days": 7
    })


@app.route("/api/stripe/create-checkout-session", methods=["POST"])
def create_checkout_session():
    """Cria uma sessão no Stripe Checkout aplicando 7 dias de trial."""
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not api_key or "placeholder" in api_key:
        return jsonify({"error": "Chave da API do Stripe (STRIPE_SECRET_KEY) não configurada no servidor."}), 500

    stripe.api_key = api_key

    body = request.get_json(silent=True) or {}
    plan = (body.get("plan") or "monthly").lower().strip()

    if plan in ("monthly", "mensal"):
        price_id = os.environ.get("STRIPE_PRICE_MONTHLY")
        plan_name = "monthly"
    elif plan in ("yearly", "anual"):
        price_id = os.environ.get("STRIPE_PRICE_YEARLY")
        plan_name = "yearly"
    else:
        price_id = body.get("price_id")
        plan_name = "custom"

    if not price_id or "placeholder" in str(price_id):
        return jsonify({
            "error": f"ID do plano '{plan}' não configurado nas variáveis de ambiente (STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY)."
        }), 400

    frontend_url = os.environ.get("FRONTEND_URL", "https://levelupstudy.com.br").rstrip("/")

    checkout_params = {
        "mode": "subscription",
        "line_items": [
            {
                "price": price_id,
                "quantity": 1,
            }
        ],
        "subscription_data": {
            "trial_period_days": 7,
            "metadata": {
                "user_id": str(user.id),
                "plan": plan_name,
            }
        },
        "client_reference_id": str(user.id),
        "metadata": {
            "user_id": str(user.id),
            "plan": plan_name,
        },
        "success_url": f"{frontend_url}/index.html?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{frontend_url}/index.html?payment=cancelled",
        "allow_promotion_codes": True,
    }

    # Vincula ao cliente existente no Stripe se já houver
    if user.stripe_customer_id:
        checkout_params["customer"] = user.stripe_customer_id
    else:
        checkout_params["customer_email"] = user.email

    try:
        checkout_session = stripe.checkout.Session.create(**checkout_params)
        return jsonify({
            "url": checkout_session.url,
            "session_id": checkout_session.id,
            "plan": plan_name,
            "trial_days": 7
        })
    except stripe.error.StripeError as e:
        app.logger.error(f"Erro Stripe na criação de checkout: {e}")
        return jsonify({"error": e.user_message or str(e)}), 400
    except Exception as e:
        app.logger.error(f"Erro inesperado no checkout: {e}")
        return jsonify({"error": "Falha ao gerar sessão de pagamento no Stripe."}), 500


@app.route("/api/stripe/create-setup-intent", methods=["POST"])
def create_setup_intent():
    """Cria um SetupIntent no Stripe para coletar dados do cartão via Stripe Elements White-Label."""
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not api_key or "placeholder" in api_key:
        return jsonify({"error": "Chave da API do Stripe não configurada."}), 500

    stripe.api_key = api_key

    body = request.get_json(silent=True) or {}
    plan = (body.get("plan") or "monthly").lower().strip()

    # Garantir que o usuário possui um customer_id na Stripe
    if not user.stripe_customer_id:
        try:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.name,
                metadata={
                    "user_id": str(user.id),
                    "app": "levelup_study"
                }
            )
            user.stripe_customer_id = customer.id
            db.session.commit()
        except Exception as e:
            app.logger.error(f"Erro ao criar cliente na Stripe: {e}")
            return jsonify({"error": f"Erro ao criar cliente no Stripe: {str(e)}"}), 500

    try:
        setup_intent = stripe.SetupIntent.create(
            customer=user.stripe_customer_id,
            automatic_payment_methods={"enabled": True},
            metadata={
                "user_id": str(user.id),
                "plan": plan,
                "app": "levelup_study"
            }
        )
        return jsonify({
            "client_secret": setup_intent.client_secret,
            "customer_id": user.stripe_customer_id,
            "plan": plan
        })
    except Exception as e:
        app.logger.error(f"Erro ao inicializar SetupIntent: {e}")
        return jsonify({"error": f"Erro ao inicializar pagamento: {str(e)}"}), 500


@app.route("/api/stripe/activate-subscription", methods=["POST"])
def activate_subscription():
    """Ativa a assinatura Concurseiro Pro com 7 dias de trial após a confirmação do SetupIntent no Stripe Elements."""
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not api_key or "placeholder" in api_key:
        return jsonify({"error": "Chave da API do Stripe não configurada."}), 500

    stripe.api_key = api_key

    body = request.get_json(silent=True) or {}
    payment_method_id = body.get("payment_method_id")
    plan = (body.get("plan") or "monthly").lower().strip()

    if not payment_method_id:
        return jsonify({"error": "Método de pagamento (payment_method_id) não fornecido."}), 400

    sub_plan = SubscriptionPlan.query.filter(
        db.or_(SubscriptionPlan.plan_key == plan, SubscriptionPlan.stripe_price_id == plan)
    ).first()

    trial_days = 7
    if sub_plan and sub_plan.stripe_price_id:
        price_id = sub_plan.stripe_price_id
        plan_name = sub_plan.plan_key
        trial_days = sub_plan.trial_days or 7
    elif plan in ("monthly", "mensal"):
        price_id = os.environ.get("STRIPE_PRICE_MONTHLY")
        plan_name = "monthly"
    elif plan in ("yearly", "anual"):
        price_id = os.environ.get("STRIPE_PRICE_YEARLY")
        plan_name = "yearly"
    else:
        price_id = body.get("price_id") or os.environ.get("STRIPE_PRICE_MONTHLY")
        plan_name = "monthly"

    if not price_id or "placeholder" in str(price_id):
        return jsonify({"error": "ID de preço não configurado para o plano selecionado."}), 400

    try:
        # 1. Definir o método de pagamento padrão do cliente
        stripe.Customer.modify(
            user.stripe_customer_id,
            invoice_settings={"default_payment_method": payment_method_id}
        )

        # 2. Criar a assinatura com trial
        sub = stripe.Subscription.create(
            customer=user.stripe_customer_id,
            items=[{"price": price_id}],
            trial_period_days=trial_days,
            default_payment_method=payment_method_id,
            metadata={
                "user_id": str(user.id),
                "plan": plan_name,
                "app": "levelup_study",
                "origin": "stripe_elements_white_label"
            }
        )

        # 3. Atualizar dados no banco de dados local
        user.subscription_status = "trialing"
        user.stripe_subscription_id = sub.id
        user.stripe_plan_id = price_id
        if hasattr(sub, "current_period_end") and sub.current_period_end:
            user.current_period_end = datetime.utcfromtimestamp(sub.current_period_end)

        app.logger.info(
            f"Assinatura {plan_name.upper()} do usuário {user.id} ({user.email}) ativada com 7 dias de teste grátis via Stripe Elements."
        )
        db.session.commit()

        return jsonify({
            "success": True,
            "subscription_id": sub.id,
            "status": "trialing",
            "plan": plan_name,
            "message": "Parabéns! Seus 7 dias grátis do Concurseiro Pro foram ativados com sucesso.",
            "redirect_url": "/index.html?payment=success"
        })
    except stripe.error.StripeError as e:
        app.logger.error(f"Erro Stripe na ativação da assinatura: {e}")
        return jsonify({"error": f"Erro na Stripe: {e.user_message or str(e)}"}), 400
    except Exception as e:
        app.logger.error(f"Erro geral na ativação da assinatura: {e}")
        return jsonify({"error": f"Erro interno ao ativar assinatura: {str(e)}"}), 500


@app.route("/api/webhooks/stripe", methods=["POST"])
def stripe_webhook():
    """Webhook do Stripe: valida assinatura e atualiza status de assinaturas e concurseiros."""
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

    if not webhook_secret or "placeholder" in webhook_secret:
        app.logger.error("STRIPE_WEBHOOK_SECRET não configurado no servidor.")
        return jsonify({"error": "Webhook secret não configurado."}), 500

    if not sig_header:
        app.logger.warning("Requisição de webhook recebida sem cabeçalho Stripe-Signature.")
        return jsonify({"error": "Cabeçalho Stripe-Signature ausente."}), 400

    api_key = os.environ.get("STRIPE_SECRET_KEY")
    if api_key:
        stripe.api_key = api_key

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=webhook_secret
        )
    except ValueError as e:
        app.logger.error(f"Payload inválido no webhook do Stripe: {e}")
        return jsonify({"error": "Payload inválido."}), 400
    except stripe.error.SignatureVerificationError as e:
        app.logger.error(f"Assinatura do webhook inválida: {e}")
        return jsonify({"error": "Assinatura do Stripe inválida."}), 400
    except stripe.error.StripeError as e:
        app.logger.error(f"Erro do Stripe no webhook: {e}")
        return jsonify({"error": "Erro na validação do Stripe."}), 400
    except Exception as e:
        app.logger.error(f"Erro inesperado na validação do webhook: {e}")
        return jsonify({"error": "Erro interno."}), 400

    event_type = event.get("type")
    data_object = event.get("data", {}).get("object", {})

    app.logger.info(f"Evento Stripe recebido: {event_type}")

    try:
        # 1. Sessão de Checkout Concluída (Início de Trial de 7 dias / Assinatura)
        if event_type == "checkout.session.completed":
            user_id = data_object.get("client_reference_id") or (data_object.get("metadata") or {}).get("user_id")
            customer_id = data_object.get("customer")
            subscription_id = data_object.get("subscription")
            customer_email = (data_object.get("customer_details") or {}).get("email")

            user = find_user_from_stripe_data(
                customer_id=customer_id,
                subscription_id=subscription_id,
                user_id=user_id,
                email=customer_email
            )

            if user:
                if customer_id:
                    user.stripe_customer_id = customer_id
                if subscription_id:
                    user.stripe_subscription_id = subscription_id

                plan_meta = (data_object.get("metadata") or {}).get("plan")
                if plan_meta:
                    user.stripe_plan_id = plan_meta

                # Com 7 dias de trial, o status inicial é 'trialing'
                user.subscription_status = "trialing" if subscription_id else "active"
                db.session.commit()
                app.logger.info(f"Usuário {user.id} ({user.email}) atualizado no checkout: status={user.subscription_status}")

        # 2. Pagamento de Fatura Bem-Sucedido (Primeira cobrança após trial ou renovação recorrente)
        elif event_type == "invoice.payment_succeeded":
            customer_id = data_object.get("customer")
            subscription_id = data_object.get("subscription")
            customer_email = data_object.get("customer_email")

            user = find_user_from_stripe_data(
                customer_id=customer_id,
                subscription_id=subscription_id,
                email=customer_email
            )

            if user:
                user.subscription_status = "active"
                if customer_id and not user.stripe_customer_id:
                    user.stripe_customer_id = customer_id
                if subscription_id and not user.stripe_subscription_id:
                    user.stripe_subscription_id = subscription_id

                lines = (data_object.get("lines") or {}).get("data", [])
                if lines:
                    line_period = lines[0].get("period", {})
                    if line_period.get("end"):
                        user.current_period_end = datetime.fromtimestamp(line_period["end"])
                    price_id = (lines[0].get("price") or {}).get("id")
                    if price_id:
                        user.stripe_plan_id = price_id

                db.session.commit()
                app.logger.info(f"Fatura paga com sucesso para o usuário {user.id}. Vigência: {user.current_period_end}")

        # 3. Falha no Pagamento da Fatura (Cartão recusado, saldo insuficiente)
        elif event_type == "invoice.payment_failed":
            customer_id = data_object.get("customer")
            subscription_id = data_object.get("subscription")
            customer_email = data_object.get("customer_email")

            user = find_user_from_stripe_data(
                customer_id=customer_id,
                subscription_id=subscription_id,
                email=customer_email
            )

            if user:
                user.subscription_status = "past_due"
                db.session.commit()
                app.logger.warning(f"Pagamento falhou para o usuário {user.id}. Status: past_due")

        # 4. Assinatura Cancelada / Deletada (Bloqueio de acesso)
        elif event_type == "customer.subscription.deleted":
            sub_id = data_object.get("id")
            customer_id = data_object.get("customer")

            user = find_user_from_stripe_data(customer_id=customer_id, subscription_id=sub_id)

            if user:
                user.subscription_status = "canceled"
                db.session.commit()
                app.logger.info(f"Assinatura cancelada para o usuário {user.id}. Status: canceled")

        # 5. Atualização de Assinatura (ex: transição de trial para ativa, troca de plano)
        elif event_type == "customer.subscription.updated":
            sub_id = data_object.get("id")
            customer_id = data_object.get("customer")
            sub_status = data_object.get("status")
            period_end = data_object.get("current_period_end")

            user = find_user_from_stripe_data(customer_id=customer_id, subscription_id=sub_id)

            if user:
                if sub_status:
                    user.subscription_status = sub_status
                if period_end:
                    user.current_period_end = datetime.fromtimestamp(period_end)
                db.session.commit()
                app.logger.info(f"Assinatura do usuário {user.id} atualizada: status={sub_status}")

        return jsonify({"received": True, "event": event_type}), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro ao persistir evento {event_type} no banco: {e}")
        return jsonify({"error": "Erro ao atualizar dados da assinatura."}), 500


@app.route("/api/stripe/create-portal-session", methods=["POST"])
def create_portal_session():
    """Redireciona o usuário para o Customer Portal do Stripe para gerenciar cartão ou cancelamento."""
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    if not user.stripe_customer_id:
        return jsonify({"error": "Nenhum cadastro de pagamento encontrado para este usuário."}), 400

    api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not api_key:
        return jsonify({"error": "Chave da API do Stripe não configurada."}), 500

    stripe.api_key = api_key
    frontend_url = os.environ.get("FRONTEND_URL", "https://levelupstudy.com.br").rstrip("/")

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=f"{frontend_url}/index.html",
        )
        return jsonify({"url": portal_session.url})
    except stripe.error.StripeError as e:
        return jsonify({"error": e.user_message or str(e)}), 400


@app.route("/api/stripe/subscription", methods=["GET"])
def get_subscription_status():
    """Consulta os dados e status da assinatura do usuário atual."""
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    return jsonify({
        "is_premium": user.is_premium,
        "subscription_status": user.subscription_status or "free",
        "plan_id": user.stripe_plan_id,
        "current_period_end": user.current_period_end.isoformat() if user.current_period_end else None,
        "has_customer": bool(user.stripe_customer_id),
    })
@app.route("/api/admin/stripe/sync-plans", methods=["POST"])
@require_role("superadmin")
def admin_sync_stripe_plans():
    """Sincroniza automaticamente os planos do LevelUp Study com a conta do Stripe."""
    try:
        from sync_stripe_plans import sync_plans_with_stripe
        sync_result = sync_plans_with_stripe()
        return jsonify({
            "ok": True,
            "message": "Planos sincronizados com sucesso no Stripe!",
            "data": sync_result
        })
    except Exception as e:
        app.logger.error(f"Erro ao sincronizar planos com o Stripe: {e}")
        return jsonify({"error": f"Falha na sincronização com o Stripe: {str(e)}"}), 500


def seed_default_subscription_plans():
    """Garante que os planos padrão (Mensal e Anual) existam no banco de dados com permissões."""
    try:
        monthly_price = os.environ.get("STRIPE_PRICE_MONTHLY")
        yearly_price = os.environ.get("STRIPE_PRICE_YEARLY")
        product_id = os.environ.get("STRIPE_PRODUCT_ID")

        default_pro_perms = {p["key"]: True for p in AVAILABLE_PERMISSIONS}

        # 1. Plano mensal
        p_monthly = SubscriptionPlan.query.filter_by(plan_key="monthly").first()
        if not p_monthly:
            p_monthly = SubscriptionPlan(
                plan_key="monthly",
                name="Concurseiro Pro Mensal",
                description="Acesso completo e irrestrito ao Mentor IA, simulados cronometrados por banca e banco de questões.",
                price_amount=19.90,
                currency="brl",
                interval="month",
                interval_count=1,
                trial_days=7,
                badge="MENSAL FLEXÍVEL",
                emoji="🛡️",
                stripe_product_id=product_id,
                stripe_price_id=monthly_price,
                is_active=True
            )
            p_monthly.set_permissions(default_pro_perms)
            db.session.add(p_monthly)
        elif monthly_price and not p_monthly.stripe_price_id:
            p_monthly.stripe_price_id = monthly_price

        # 2. Plano anual
        p_yearly = SubscriptionPlan.query.filter_by(plan_key="yearly").first()
        if not p_yearly:
            p_yearly = SubscriptionPlan(
                plan_key="yearly",
                name="Concurseiro Pro Anual",
                description="O plano definitivo até a posse com 17% de desconto e ferramentas completas por 1 ano.",
                price_amount=199.00,
                currency="brl",
                interval="year",
                interval_count=1,
                trial_days=7,
                badge="17% OFF",
                emoji="⚔️",
                stripe_product_id=product_id,
                stripe_price_id=yearly_price,
                is_active=True
            )
            p_yearly.set_permissions(default_pro_perms)
            db.session.add(p_yearly)
        elif yearly_price and not p_yearly.stripe_price_id:
            p_yearly.stripe_price_id = yearly_price

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.warning(f"Aviso ao inicializar planos padrão: {e}")


@app.route("/api/admin/plans", methods=["GET"])
@require_role("superadmin", "admin")
def admin_get_plans():
    """Lista todos os planos cadastrados, permissões e status no Stripe."""
    seed_default_subscription_plans()
    plans = SubscriptionPlan.query.order_by(SubscriptionPlan.price_amount.asc()).all()

    # Contagem de assinantes por plano
    user_counts = {}
    users_with_sub = User.query.filter(User.subscription_status.in_(["active", "trialing"])).all()
    for u in users_with_sub:
        pk = (u.stripe_plan_id or "").lower()
        user_counts[pk] = user_counts.get(pk, 0) + 1

    plans_data = []
    for p in plans:
        pd = p.to_dict()
        subscribers = user_counts.get(p.plan_key, 0) + (user_counts.get((p.stripe_price_id or "").lower(), 0) if p.stripe_price_id else 0)
        pd["subscribers_count"] = subscribers
        plans_data.append(pd)

    return jsonify({
        "ok": True,
        "plans": plans_data,
        "available_permissions": AVAILABLE_PERMISSIONS,
        "stripe_configured": bool(os.environ.get("STRIPE_SECRET_KEY"))
    })


@app.route("/api/admin/plans", methods=["POST"])
@require_role("superadmin")
def admin_create_plan():
    """Cria um novo plano no sistema e sincroniza automaticamente com o Stripe Live."""
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    price_val = body.get("price_amount") if body.get("price_amount") is not None else body.get("price_brl")
    interval = (body.get("interval") or "month").strip().lower()
    interval_count = int(body.get("interval_count") or 1)
    trial_days = int(body.get("trial_days") or 7)
    badge = (body.get("badge") or "").strip()
    emoji = (body.get("emoji") or "🛡️").strip()
    description = (body.get("description") or "").strip()
    permissions = body.get("permissions") or {}

    if not name:
        return jsonify({"error": "O nome do plano é obrigatório."}), 400
    try:
        price_amount = float(price_val)
        if price_amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Valor do plano inválido. Digite um número positivo."}), 400

    if interval not in ("day", "week", "month", "year"):
        interval = "month"

    # Gerar slug da chave do plano
    base_slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    plan_key = (body.get("plan_key") or f"{base_slug}_{interval}").strip().lower()
    counter = 1
    while SubscriptionPlan.query.filter_by(plan_key=plan_key).first():
        plan_key = f"{base_slug}_{interval}_{counter}"
        counter += 1

    # Sincronização com Stripe Live
    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_key:
        return jsonify({"error": "STRIPE_SECRET_KEY não configurada no servidor."}), 500

    stripe.api_key = stripe_key
    stripe_product_id = os.environ.get("STRIPE_PRODUCT_ID")

    try:
        # 1. Garantir que o produto existe na conta Stripe
        if not stripe_product_id:
            existing_prods = stripe.Product.list(limit=20, active=True)
            for p in existing_prods.data:
                meta = p.metadata.to_dict() if hasattr(p, "metadata") and p.metadata else {}
                if meta.get("app") == "levelup_study" or "LevelUp Study" in (p.name or ""):
                    stripe_product_id = p.id
                    break
            if not stripe_product_id:
                prod = stripe.Product.create(
                    name="LevelUp Study - Concurseiro Pro",
                    description="Planos de Assinatura LevelUp Study",
                    metadata={"app": "levelup_study"}
                )
                stripe_product_id = prod.id

        # 2. Criar o preço correspondente na Stripe
        unit_amount = int(round(price_amount * 100))  # valor em centavos
        price_obj = stripe.Price.create(
            product=stripe_product_id,
            unit_amount=unit_amount,
            currency="brl",
            recurring={"interval": interval, "interval_count": interval_count},
            nickname=f"LevelUp - {name}",
            metadata={
                "app": "levelup_study",
                "plan_key": plan_key,
                "created_by": "superadmin"
            }
        )
        stripe_price_id = price_obj.id

    except stripe.error.StripeError as se:
        app.logger.error(f"Erro Stripe ao criar plano: {se}")
        return jsonify({"error": f"Erro retornado pela Stripe: {se.user_message or str(se)}"}), 400
    except Exception as e:
        app.logger.error(f"Erro inesperado ao sincronizar com Stripe: {e}")
        return jsonify({"error": f"Falha na comunicação com o Stripe: {str(e)}"}), 500

    # 3. Salvar no banco de dados
    new_plan = SubscriptionPlan(
        plan_key=plan_key,
        name=name,
        description=description,
        price_amount=price_amount,
        currency="brl",
        interval=interval,
        interval_count=interval_count,
        trial_days=trial_days,
        badge=badge,
        emoji=emoji,
        stripe_product_id=stripe_product_id,
        stripe_price_id=stripe_price_id,
        is_active=True
    )
    new_plan.set_permissions(permissions)
    db.session.add(new_plan)
    db.session.commit()

    return jsonify({
        "ok": True,
        "message": f"Plano '{name}' criado e sincronizado com o Stripe Live com sucesso!",
        "plan": new_plan.to_dict()
    }), 201


@app.route("/api/admin/plans/<int:plan_id>/toggle", methods=["POST"])
@require_role("superadmin")
def admin_toggle_plan(plan_id: int):
    """Ativa ou desativa um plano no sistema e na Stripe."""
    plan = db.session.get(SubscriptionPlan, plan_id)
    if not plan:
        return jsonify({"error": "Plano não encontrado."}), 404

    plan.is_active = not plan.is_active

    if plan.stripe_price_id and os.environ.get("STRIPE_SECRET_KEY"):
        try:
            stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
            stripe.Price.modify(plan.stripe_price_id, active=plan.is_active)
        except Exception as e:
            app.logger.warning(f"Aviso ao alterar status do preço na Stripe: {e}")

    db.session.commit()
    return jsonify({
        "ok": True,
        "is_active": plan.is_active,
        "message": f"Plano '{plan.name}' {'ativado' if plan.is_active else 'desativado'} com sucesso.",
        "plan": plan.to_dict()
    })


@app.route("/api/admin/plans/<int:plan_id>", methods=["PUT"])
@require_role("superadmin")
def admin_update_plan(plan_id: int):
    """Atualiza as propriedades e permissões de um plano existente."""
    plan = db.session.get(SubscriptionPlan, plan_id)
    if not plan:
        return jsonify({"error": "Plano não encontrado."}), 404

    body = request.get_json(silent=True) or {}
    
    if "name" in body and body["name"]:
        plan.name = str(body["name"]).strip()
    if "description" in body:
        plan.description = str(body["description"] or "").strip()
    if "badge" in body:
        plan.badge = str(body["badge"] or "").strip()
    if "emoji" in body and body["emoji"]:
        plan.emoji = str(body["emoji"]).strip()
    if "trial_days" in body:
        try:
            plan.trial_days = max(0, int(body["trial_days"]))
        except (ValueError, TypeError):
            pass
    if "is_active" in body:
        plan.is_active = bool(body["is_active"])
    if "permissions" in body and isinstance(body["permissions"], dict):
        plan.set_permissions(body["permissions"])

    new_price = body.get("price_amount") if body.get("price_amount") is not None else body.get("price_brl")
    if new_price is not None:
        try:
            price_val = float(new_price)
            if price_val > 0 and abs(price_val - plan.price_amount) > 0.001:
                plan.price_amount = price_val
                stripe_key = os.environ.get("STRIPE_SECRET_KEY")
                if stripe_key and plan.stripe_product_id:
                    try:
                        stripe.api_key = stripe_key
                        unit_amount = int(round(price_val * 100))
                        new_price_obj = stripe.Price.create(
                            product=plan.stripe_product_id,
                            unit_amount=unit_amount,
                            currency="brl",
                            recurring={"interval": plan.interval, "interval_count": plan.interval_count},
                            nickname=f"LevelUp - {plan.name}",
                            metadata={"plan_key": plan.plan_key, "updated_by": "superadmin"}
                        )
                        plan.stripe_price_id = new_price_obj.id
                    except Exception as se:
                        app.logger.warning(f"Aviso ao sincronizar novo preço na Stripe: {se}")
        except (ValueError, TypeError):
            pass

    db.session.commit()
    return jsonify({
        "ok": True,
        "message": f"Plano '{plan.name}' atualizado com sucesso!",
        "plan": plan.to_dict()
    })


@app.route("/api/admin/plans/<int:plan_id>", methods=["DELETE"])
@require_role("superadmin")
def admin_delete_plan(plan_id: int):
    """Exclui ou desativa um plano no sistema com validação de segurança para alunos ativos."""
    plan = db.session.get(SubscriptionPlan, plan_id)
    if not plan:
        return jsonify({"error": "Plano não encontrado."}), 404

    active_subscribers = User.query.filter(
        db.or_(
            User.stripe_plan_id == plan.plan_key,
            User.stripe_plan_id == plan.stripe_price_id
        )
    ).count()

    if active_subscribers > 0:
        plan.is_active = False
        if plan.stripe_price_id and os.environ.get("STRIPE_SECRET_KEY"):
            try:
                stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
                stripe.Price.modify(plan.stripe_price_id, active=False)
            except Exception:
                pass
        db.session.commit()
        return jsonify({
            "ok": True,
            "action": "deactivated",
            "message": f"O plano '{plan.name}' possui {active_subscribers} aluno(s) com assinatura ativa. Ele foi desativado para novas compras para preservar o histórico e acesso dos alunos.",
            "plan": plan.to_dict()
        })

    if plan.stripe_price_id and os.environ.get("STRIPE_SECRET_KEY"):
        try:
            stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
            stripe.Price.modify(plan.stripe_price_id, active=False)
        except Exception as se:
            app.logger.warning(f"Aviso ao desativar preço no Stripe: {se}")

    db.session.delete(plan)
    db.session.commit()
    return jsonify({
        "ok": True,
        "action": "deleted",
        "message": f"Plano '{plan.name}' excluído com sucesso."
    })


@app.route("/api/admin/plans/<int:plan_id>/sync", methods=["POST"])
@require_role("superadmin")
def admin_sync_single_plan(plan_id: int):
    """Força a sincronização do plano com a Stripe Live."""
    plan = db.session.get(SubscriptionPlan, plan_id)
    if not plan:
        return jsonify({"error": "Plano não encontrado."}), 404

    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_key:
        return jsonify({"error": "STRIPE_SECRET_KEY não configurada no servidor."}), 500

    stripe.api_key = stripe_key
    try:
        product_id = os.environ.get("STRIPE_PRODUCT_ID") or plan.stripe_product_id
        if not product_id:
            prod = stripe.Product.create(
                name="LevelUp Study - Concurseiro Pro",
                description="Planos de Assinatura LevelUp Study",
                metadata={"app": "levelup_study"}
            )
            product_id = prod.id
            plan.stripe_product_id = product_id

        unit_amount = int(round(plan.price_amount * 100))
        price_obj = stripe.Price.create(
            product=product_id,
            unit_amount=unit_amount,
            currency="brl",
            recurring={"interval": plan.interval, "interval_count": plan.interval_count},
            nickname=f"LevelUp - {plan.name}",
            metadata={"app": "levelup_study", "plan_key": plan.plan_key}
        )
        plan.stripe_price_id = price_obj.id
        db.session.commit()

        return jsonify({
            "ok": True,
            "message": f"Plano '{plan.name}' sincronizado com a Stripe com sucesso! (Price ID: {price_obj.id})",
            "plan": plan.to_dict()
        })
    except Exception as e:
        return jsonify({"error": f"Falha na sincronização com a Stripe: {str(e)}"}), 400


@app.route("/api/admin/report", methods=["GET"])
@require_role("superadmin", "admin")
def admin_executive_report():
    """Retorna o relatório executivo completo com Unit Economics e viabilidade financeira."""
    total_users = User.query.count()
    pro_users = User.query.filter(User.subscription_status.in_(["active", "trialing"])).count()
    free_users = max(0, total_users - pro_users)
    trial_users = User.query.filter_by(subscription_status="trialing").count()
    churned_users = User.query.filter_by(subscription_status="canceled").count()

    mrr = 0.0
    users_with_sub = User.query.filter(User.subscription_status.in_(["active", "trialing"])).all()
    for u in users_with_sub:
        plan_id = (u.stripe_plan_id or "").lower()
        sub_plan = SubscriptionPlan.query.filter(
            db.or_(SubscriptionPlan.stripe_price_id == u.stripe_plan_id, SubscriptionPlan.plan_key == plan_id)
        ).first()
        if sub_plan:
            if sub_plan.interval == "year":
                mrr += (sub_plan.price_amount / 12.0)
            else:
                mrr += sub_plan.price_amount
        else:
            if "year" in plan_id:
                mrr += (199.00 / 12.0)
            elif u.stripe_plan_id:
                mrr += 19.90

    server_cost = 149.00
    ai_api_cost = 99.50
    tools_cost = 50.00
    total_fixed_cost = server_cost + ai_api_cost + tools_cost

    ticket_medio = (mrr / pro_users) if pro_users > 0 else 19.90
    breakeven_subscribers = int(round(total_fixed_cost / 19.90))
    coverage_pct = min(100.0, round((mrr / total_fixed_cost) * 100, 1)) if total_fixed_cost > 0 else 100.0

    ltv = ticket_medio * 9.0
    cac = 12.40
    ltv_cac_ratio = round(ltv / cac, 1) if cac > 0 else 0

    return jsonify({
        "ok": True,
        "generated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "executive_summary": {
            "total_users": total_users,
            "pro_users": pro_users,
            "free_users": free_users,
            "trial_users": trial_users,
            "churned_users": churned_users,
            "conversion_rate": round((pro_users / total_users * 100), 1) if total_users > 0 else 0.0,
            "mrr": round(mrr, 2),
            "arr": round(mrr * 12, 2),
            "formatted_mrr": f"R$ {mrr:.2f}".replace(".", ","),
            "formatted_arr": f"R$ {mrr * 12:.2f}".replace(".", ",")
        },
        "unit_economics": {
            "breakeven_subscribers": breakeven_subscribers,
            "breakeven_cost": total_fixed_cost,
            "formatted_breakeven_cost": f"R$ {total_fixed_cost:.2f}".replace(".", ","),
            "coverage_pct": coverage_pct,
            "subscribers_needed": max(0, breakeven_subscribers - pro_users),
            "ltv": round(ltv, 2),
            "formatted_ltv": f"R$ {ltv:.2f}".replace(".", ","),
            "cac": cac,
            "formatted_cac": f"R$ {cac:.2f}".replace(".", ","),
            "ltv_cac_ratio": ltv_cac_ratio,
            "retention_months": 9,
            "payback_months": 0.8
        },
        "cost_breakdown": [
            {"item": "Servidor VPS Dedicado (HestiaCP / Nginx / MySQL)", "cost": server_cost, "formatted": f"R$ {server_cost:.2f}".replace(".", ",")},
            {"item": "APIs de Inteligência Artificial (Google Gemini Flash)", "cost": ai_api_cost, "formatted": f"R$ {ai_api_cost:.2f}".replace(".", ",")},
            {"item": "Infraestrutura de Rede, SSL & Ferramentas", "cost": tools_cost, "formatted": f"R$ {tools_cost:.2f}".replace(".", ",")}
        ],
        "projections": [
            {"scenario": "Cenário Atual", "subscribers": pro_users, "mrr": round(mrr, 2), "coverage": coverage_pct},
            {"scenario": "Break-Even (Ponto de Equilíbrio)", "subscribers": breakeven_subscribers, "mrr": total_fixed_cost, "coverage": 100.0},
            {"scenario": "Crescimento Moderado (6 meses)", "subscribers": 50, "mrr": 995.00, "coverage": 333.3},
            {"scenario": "Escala Nacional (12 meses)", "subscribers": 200, "mrr": 3980.00, "coverage": 1333.3}
        ]
    })


@app.route("/api/plans", methods=["GET"])
def public_get_plans():
    """Retorna os planos ativos para exibição pública."""
    seed_default_subscription_plans()
    plans = SubscriptionPlan.query.filter_by(is_active=True).order_by(SubscriptionPlan.price_amount.asc()).all()
    return jsonify({
        "ok": True,
        "plans": [p.to_dict() for p in plans],
        "available_permissions": AVAILABLE_PERMISSIONS
    })


# ── Super Admin Endpoints ──────────────────────────────────────────────────
@app.route("/api/admin/stats", methods=["GET"])
@require_role("superadmin", "admin")
def admin_stats():
    """Retorna métricas financeiras (MRR, churn), operacionais e de usuários."""
    from sqlalchemy import func
    total_users = User.query.count()

    # Contagem de assinantes
    active_subscribers = User.query.filter(
        User.subscription_status.in_(["active", "trialing"])
    ).count()

    trial_users = User.query.filter_by(subscription_status="trialing").count()
    past_due_users = User.query.filter_by(subscription_status="past_due").count()
    canceled_users = User.query.filter_by(subscription_status="canceled").count()
    free_users = max(0, total_users - active_subscribers - past_due_users - canceled_users)

    # Cálculo do MRR (Receita Recorrente Mensal estimada conforme Modelo Canvas / Pitch Deck)
    # Preço base do Canvas: Mensal R$ 19,90 | Anual R$ 199,00 (~ R$ 16,58/mês)
    price_monthly = float(os.environ.get("STRIPE_PRICE_MONTHLY_BRL", 19.90))
    price_yearly_monthly = float(os.environ.get("STRIPE_PRICE_YEARLY_BRL", 199.00)) / 12.0
    mrr = 0.0
    active_users = User.query.filter(User.subscription_status.in_(["active", "trialing"])).all()
    for u in active_users:
        plan = (u.stripe_plan_id or "").lower()
        if "year" in plan or "anual" in plan:
            mrr += price_yearly_monthly
        else:
            mrr += price_monthly

    # Taxa de Churn (%)
    total_ever_subscribed = active_subscribers + past_due_users + canceled_users
    churn_rate = 0.0
    if total_ever_subscribed > 0:
        churn_rate = round((canceled_users / total_ever_subscribed) * 100, 1)

    # ── Métricas Reais de Estudo e Gamificação ─────────────────────────────
    total_pomodoros = db.session.query(func.sum(UserStats.total_pomodoros)).scalar() or 0
    total_xp = db.session.query(func.sum(UserStats.xp)).scalar() or 0
    total_tasks_completed = Task.query.filter_by(done=True).count()

    # ── Evolução Mensal Real (Últimos 6 meses calculados a partir dos usuários cadastrados no banco) ──
    import calendar
    import concurseiro_bank

    now = datetime.utcnow()
    mrr_evolution = []
    month_names = {
        1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
        7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"
    }

    for i in range(5, -1, -1):
        ref_year = now.year
        ref_month = now.month - i
        while ref_month <= 0:
            ref_month += 12
            ref_year -= 1

        _, last_day = calendar.monthrange(ref_year, ref_month)
        end_of_ref_month = datetime(ref_year, ref_month, last_day, 23, 59, 59)

        users_up_to_month = User.query.filter(User.created_at <= end_of_ref_month).all()
        month_pro = sum(1 for u in users_up_to_month if u.subscription_status in ("active", "trialing"))
        month_free = max(0, len(users_up_to_month) - month_pro)
        month_mrr = round(month_pro * price_monthly, 2)

        mrr_evolution.append({
            "month": month_names.get(ref_month, str(ref_month)),
            "mrr": month_mrr,
            "pro": month_pro,
            "free": month_free
        })

    # ── Distribuição Real de Questões do Banco de Concurso e Histórico de Simulados ──
    subjects_map = {}
    for q in concurseiro_bank.CONCURSO_QUESTIONS:
        subj = q.get("subject", "Geral")
        subjects_map[subj] = subjects_map.get(subj, 0) + 1

    total_bank_q = len(concurseiro_bank.CONCURSO_QUESTIONS)

    try:
        sim_submissions = SimuladoHistory.query.all()
    except Exception:
        sim_submissions = []

    sub_accuracy = {}
    for s in sim_submissions:
        if s.subject not in sub_accuracy:
            sub_accuracy[s.subject] = {"correct": 0, "total": 0}
        sub_accuracy[s.subject]["correct"] += s.correct_count
        sub_accuracy[s.subject]["total"] += s.total_questions

    subjects_breakdown = []
    for subj, qcount in sorted(subjects_map.items(), key=lambda x: -x[1]):
        pct = round((qcount / total_bank_q * 100), 1) if total_bank_q > 0 else 0
        acc_data = sub_accuracy.get(subj)
        real_acc = round((acc_data["correct"] / acc_data["total"]) * 100, 1) if acc_data and acc_data["total"] > 0 else 0.0
        answered = acc_data["total"] if acc_data else 0

        subjects_breakdown.append({
            "subject": subj,
            "questions_count": qcount,
            "percentage": pct,
            "accuracy": real_acc,
            "answered_count": answered,
            "total_in_bank": total_bank_q
        })

    # ── Unit Economics & Break-Even Real ──────────────────────────────────
    break_even_mrr = 298.50  # 15 assinantes x R$ 19,90 cobrem servidor e infraestrutura
    current_mrr_calc = round(mrr, 2)
    coverage_pct = round((current_mrr_calc / break_even_mrr) * 100, 1) if break_even_mrr > 0 else 0
    subs_needed = max(0, 15 - active_subscribers)
    break_even_status = "Sustentável (100% Coberto)" if current_mrr_calc >= break_even_mrr else f"Faltam {subs_needed} assinantes Pro"

    return jsonify({
        "financial": {
            "mrr": current_mrr_calc,
            "mrr_formatted": f"R$ {current_mrr_calc:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            "churn_rate": churn_rate,
            "active_subscribers": active_subscribers,
            "trial_users": trial_users,
            "past_due_users": past_due_users,
            "canceled_users": canceled_users,
            "free_users": free_users,
        },
        "users": {
            "total": total_users,
            "conversion_rate": round((active_subscribers / total_users * 100), 1) if total_users > 0 else 0,
        },
        "engagement": {
            "total_pomodoros": int(total_pomodoros),
            "total_xp": int(total_xp),
            "total_tasks_completed": total_tasks_completed,
            "total_questions_in_bank": total_bank_q,
            "total_simulados_completed": len(sim_submissions)
        },
        "charts": {
            "break_even_mrr": break_even_mrr,
            "break_even_subscribers": 15,
            "mrr_evolution": mrr_evolution,
            "subjects_breakdown": subjects_breakdown,
            "unit_economics": {
                "cac": 12.40,
                "ltv": 179.10,
                "ltv_cac_ratio": 14.4,
                "target_subscribers": 15,
                "current_subscribers": active_subscribers,
                "break_even_status": break_even_status,
                "coverage_percentage": coverage_pct,
                "break_even_mrr": break_even_mrr,
                "current_mrr": current_mrr_calc
            }
        }
    })


@app.route("/api/admin/users", methods=["GET"])
@require_role("superadmin", "admin")
def admin_users():
    """Listagem detalhada de usuários com filtros e status de assinatura."""
    search = (request.args.get("search") or request.args.get("q") or "").strip().lower()
    role_filter = (request.args.get("role") or "").strip().lower()
    status_filter = (request.args.get("status") or "").strip().lower()

    query = User.query

    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )

    if role_filter and role_filter != "all":
        query = query.filter_by(role=role_filter)

    if status_filter and status_filter != "all":
        if status_filter == "premium" or status_filter == "active":
            query = query.filter(User.subscription_status.in_(["active", "trialing"]))
        elif status_filter == "free":
            query = query.filter(
                (User.subscription_status.is_(None)) | (User.subscription_status.in_(["free", ""]))
            )
        else:
            query = query.filter_by(subscription_status=status_filter)

    users_list = query.order_by(User.id.desc()).limit(150).all()

    result = []
    for u in users_list:
        stats = u.stats
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "plan_name": u.plan_name,
            "created_at": u.created_at.strftime("%d/%m/%Y %H:%M") if u.created_at else "-",
            "interests": u.interests or "",
            "is_premium": u.is_premium,
            "is_admin": u.is_admin,
            "subscription_status": u.subscription_status or "free",
            "stripe_plan_id": u.stripe_plan_id or "-",
            "stripe_customer_id": u.stripe_customer_id or "-",
            "stripe_subscription_id": u.stripe_subscription_id or "-",
            "current_period_end": u.current_period_end.strftime("%d/%m/%Y") if u.current_period_end else None,
            "stats": {
                "level": stats.level if stats else 1,
                "xp": stats.xp if stats else 0,
                "streak": stats.streak if stats else 0,
                "total_pomodoros": stats.total_pomodoros if stats else 0,
            },
            "permissions": u.get_permissions()
        })

    return jsonify({
        "ok": True,
        "users": result,
        "total": len(result)
    })



@app.route("/api/admin/users/<int:user_id>/bypass-premium", methods=["POST"])
@require_role("superadmin", "admin")
def admin_bypass_premium(user_id: int):
    """Bypass Manual: ativa ou revoga o acesso premium de um concurseiro sem depender do Stripe."""
    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "Usuário não encontrado."}), 404

    body = request.get_json(silent=True) or {}
    action = (body.get("action") or "grant").lower().strip()
    days = int(body.get("days") or 30)

    if action == "grant":
        target_user.subscription_status = "active"
        if days >= 9999:  # Vitalício
            target_user.current_period_end = datetime(2099, 12, 31, 23, 59, 59)
            target_user.stripe_plan_id = "bypass_lifetime"
        else:
            base_date = target_user.current_period_end if (target_user.current_period_end and target_user.current_period_end > datetime.utcnow()) else datetime.utcnow()
            target_user.current_period_end = base_date + timedelta(days=days)
            target_user.stripe_plan_id = f"bypass_{days}d"

        db.session.commit()
        return jsonify({
            "ok": True,
            "message": f"Acesso Premium concedido com sucesso para {target_user.name}.",
            "user": target_user.to_public(),
            "action": "grant",
            "days": days
        })

    elif action == "revoke":
        target_user.subscription_status = "canceled"
        target_user.current_period_end = datetime.utcnow() - timedelta(days=1)
        db.session.commit()
        return jsonify({
            "ok": True,
            "message": f"Acesso Premium revogado para {target_user.name}.",
            "user": target_user.to_public(),
            "action": "revoke"
        })
    else:
        return jsonify({"error": "Ação inválida. Utilize 'grant' ou 'revoke'."}), 400


@app.route("/api/admin/users/<int:user_id>/role", methods=["POST"])
@require_role("superadmin")
def admin_change_role(user_id: int):
    """Permite ao Super Admin alterar a role de um usuário (student, admin, superadmin)."""
    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "Usuário não encontrado."}), 404

    body = request.get_json(silent=True) or {}
    new_role = (body.get("role") or "").lower().strip()

    if new_role not in ("student", "admin", "superadmin"):
        return jsonify({"error": "Cargo inválido. Escolha entre: student, admin, superadmin."}), 400

    target_user.role = new_role
    db.session.commit()
    return jsonify({
        "ok": True,
        "message": f"Cargo de {target_user.name} alterado para {new_role}.",
        "user": target_user.to_public()
    })


@app.route("/api/admin/users", methods=["POST"])
@require_role("superadmin", "admin")
def admin_create_user():
    """Cria um novo usuário/concurseiro diretamente pelo painel administrativo."""
    caller = current_user()
    body = request.get_json(silent=True) or {}

    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    role = (body.get("role") or "student").strip().lower()
    subscription_status = (body.get("subscription_status") or "free").strip().lower()
    plan_id = (body.get("stripe_plan_id") or body.get("plan") or "concurseiro_pro_manual").strip()
    days = int(body.get("days") or 30)
    initial_xp = int(body.get("xp") or 0)

    if not name:
        return jsonify({"error": "O nome do usuário é obrigatório."}), 400
    if not email or "@" not in email:
        return jsonify({"error": "E-mail inválido ou não informado."}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "A senha deve conter no mínimo 6 caracteres."}), 400

    # Validação de Role e Permissão do Caller
    if role not in ("student", "admin", "superadmin"):
        return jsonify({"error": "Cargo inválido. Escolha entre: student, admin, superadmin."}), 400
    if role in ("admin", "superadmin") and caller.role != "superadmin":
        return jsonify({"error": "Apenas Super Admins podem cadastrar outros administradores."}), 403

    # Verificar unicidade do e-mail
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Já existe um usuário cadastrado com este e-mail."}), 409

    # Configuração de Vigência e Status
    current_period_end = None
    if subscription_status in ("active", "trialing"):
        if days >= 9999:
            current_period_end = datetime(2099, 12, 31, 23, 59, 59)
            plan_id = "concurseiro_pro_vitalicio"
        else:
            current_period_end = datetime.utcnow() + timedelta(days=days)
    else:
        subscription_status = "free"
        plan_id = None

    new_user = User(
        name=name,
        email=email,
        role=role,
        subscription_status=subscription_status,
        stripe_plan_id=plan_id,
        current_period_end=current_period_end
    )
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.flush()

    stats = UserStats(
        user_id=new_user.id,
        xp=max(0, initial_xp),
        streak=0,
        total_pomodoros=0
    )
    db.session.add(stats)
    db.session.commit()

    return jsonify({
        "ok": True,
        "message": f"Usuário '{new_user.name}' cadastrado com sucesso!",
        "user": new_user.to_public()
    }), 201


@app.route("/api/admin/users/<int:user_id>", methods=["GET"])
@require_role("superadmin", "admin")
def admin_get_user(user_id: int):
    """Retorna detalhes completos do usuário, incluindo métricas, progresso e simulados."""
    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "Usuário não encontrado."}), 404

    stats = target_user.stats or get_or_create_stats(target_user)
    tasks_total = Task.query.filter_by(user_id=user_id).count()
    tasks_done = Task.query.filter_by(user_id=user_id, done=True).count()

    simulados = SimuladoHistory.query.filter_by(user_id=user_id).order_by(SimuladoHistory.id.desc()).limit(10).all()
    sim_count = SimuladoHistory.query.filter_by(user_id=user_id).count()
    avg_acc = 0.0
    total_q = 0
    if sim_count > 0:
        all_sims = SimuladoHistory.query.filter_by(user_id=user_id).all()
        avg_acc = round(sum(s.accuracy_pct for s in all_sims) / sim_count, 1)
        total_q = sum(s.total_questions for s in all_sims)

    return jsonify({
        "id": target_user.id,
        "name": target_user.name,
        "email": target_user.email,
        "role": target_user.role,
        "plan_name": target_user.plan_name,
        "interests": target_user.interests or "",
        "created_at": target_user.created_at.strftime("%d/%m/%Y %H:%M") if target_user.created_at else "-",
        "is_premium": target_user.is_premium,
        "is_admin": target_user.is_admin,
        "subscription_status": target_user.subscription_status or "free",
        "stripe_plan_id": target_user.stripe_plan_id or "-",
        "stripe_customer_id": target_user.stripe_customer_id or "-",
        "stripe_subscription_id": target_user.stripe_subscription_id or "-",
        "current_period_end": target_user.current_period_end.strftime("%Y-%m-%d") if target_user.current_period_end else None,
        "current_period_end_formatted": target_user.current_period_end.strftime("%d/%m/%Y") if target_user.current_period_end else None,
        "stats": {
            "level": stats.level,
            "xp": stats.xp,
            "streak": stats.streak,
            "total_pomodoros": stats.total_pomodoros,
            "last_study_date": stats.last_study_date or "-"
        },
        "tasks": {
            "total": tasks_total,
            "completed": tasks_done
        },
        "simulados_summary": {
            "total_taken": sim_count,
            "average_accuracy": avg_acc,
            "total_questions_answered": total_q,
            "recent": [
                {
                    "id": s.id,
                    "subject": s.subject,
                    "accuracy_pct": s.accuracy_pct,
                    "correct_count": s.correct_count,
                    "total_questions": s.total_questions,
                    "xp_awarded": s.xp_awarded,
                    "created_at": s.created_at.strftime("%d/%m/%Y %H:%M") if s.created_at else "-"
                } for s in simulados
            ]
        },
        "permissions": target_user.get_permissions()
    })


@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
@require_role("superadmin", "admin")
def admin_update_user(user_id: int):
    """Atualização completa dos dados cadastrais, cargo, assinatura e gamificação do usuário."""
    caller = current_user()
    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "Usuário não encontrado."}), 404

    # Proteções de hierarquia
    if caller.role != "superadmin":
        if target_user.role in ("admin", "superadmin"):
            return jsonify({"error": "Permissão insuficiente para alterar dados de outro administrador."}), 403

    body = request.get_json(silent=True) or {}

    # 1. Nome
    if "name" in body:
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"error": "O nome não pode ficar vazio."}), 400
        target_user.name = name

    # 2. Email
    if "email" in body:
        email = (body.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return jsonify({"error": "E-mail inválido."}), 400
        if email != target_user.email:
            existing = User.query.filter_by(email=email).first()
            if existing and existing.id != target_user.id:
                return jsonify({"error": "Este e-mail já está em uso por outro usuário."}), 409
            target_user.email = email

    # 3. Senha (opcional)
    new_password = body.get("password")
    if new_password and len(str(new_password).strip()) > 0:
        if len(str(new_password).strip()) < 6:
            return jsonify({"error": "A nova senha deve ter no mínimo 6 caracteres."}), 400
        target_user.set_password(str(new_password).strip())

    # 4. Cargo (Role)
    if "role" in body:
        role = (body.get("role") or "").strip().lower()
        if role in ("student", "admin", "superadmin"):
            if role in ("admin", "superadmin") and caller.role != "superadmin":
                return jsonify({"error": "Apenas Super Admin pode promover usuários a cargos administrativos."}), 403
            if target_user.id == caller.id and role != "superadmin" and caller.role == "superadmin":
                return jsonify({"error": "Você não pode revogar seu próprio cargo de Super Admin."}), 400
            target_user.role = role

    # 5. Assinatura e Vigência
    if "subscription_status" in body:
        sub_status = (body.get("subscription_status") or "").strip().lower()
        if sub_status in ("free", "active", "trialing", "past_due", "canceled"):
            target_user.subscription_status = sub_status
            if sub_status == "free":
                target_user.current_period_end = None
                target_user.stripe_plan_id = None
            elif sub_status in ("active", "trialing"):
                if "days" in body:
                    days = int(body.get("days") or 30)
                    if days >= 9999:
                        target_user.current_period_end = datetime(2099, 12, 31, 23, 59, 59)
                        target_user.stripe_plan_id = "concurseiro_pro_vitalicio"
                    else:
                        base = target_user.current_period_end if (target_user.current_period_end and target_user.current_period_end > datetime.utcnow()) else datetime.utcnow()
                        target_user.current_period_end = base + timedelta(days=days)
                        if not target_user.stripe_plan_id:
                            target_user.stripe_plan_id = "concurseiro_pro_mensal"
                elif "current_period_end" in body and body.get("current_period_end"):
                    try:
                        date_str = body.get("current_period_end").strip()
                        target_user.current_period_end = datetime.strptime(date_str, "%Y-%m-%d")
                    except ValueError:
                        pass

    if "stripe_plan_id" in body and body.get("stripe_plan_id"):
        target_user.stripe_plan_id = body.get("stripe_plan_id").strip()

    # 6. Gamificação (XP, Streak, Pomodoros)
    stats = target_user.stats or get_or_create_stats(target_user)
    if "xp" in body and body.get("xp") is not None:
        stats.xp = max(0, int(body.get("xp")))
    if "streak" in body and body.get("streak") is not None:
        stats.streak = max(0, int(body.get("streak")))
    if "total_pomodoros" in body and body.get("total_pomodoros") is not None:
        stats.total_pomodoros = max(0, int(body.get("total_pomodoros")))

    db.session.commit()
    return jsonify({
        "ok": True,
        "message": f"Dados de {target_user.name} atualizados com sucesso!",
        "user": target_user.to_public()
    })


@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@require_role("superadmin")
def admin_delete_user(user_id: int):
    """Exclui permanentemente um usuário e seus dados associados com proteção contra auto-exclusão."""
    caller = current_user()
    if caller.id == user_id:
        return jsonify({"error": "Você não pode excluir sua própria conta de Super Admin."}), 400

    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "Usuário não encontrado."}), 404

    target_name = target_user.name
    try:
        # Limpeza em cascata explícita de registros dependentes
        SimuladoHistory.query.filter_by(user_id=user_id).delete()
        Task.query.filter_by(user_id=user_id).delete()
        UserStats.query.filter_by(user_id=user_id).delete()

        db.session.delete(target_user)
        db.session.commit()
        return jsonify({
            "ok": True,
            "message": f"Concurseiro '{target_name}' (# {user_id}) e todos os seus registros foram excluídos com sucesso."
        })
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro ao excluir usuário {user_id}: {e}")
        return jsonify({"error": f"Falha ao excluir usuário: {str(e)}"}), 500



# ── Módulo Concurseiro & Planos (Lean Canvas / Modelo de Negócio) ──────────
@app.route("/api/plans", methods=["GET"])
def get_plans():
    """Retorna a matriz de planos e permissões alinhada ao Canvas do projeto."""
    return jsonify({
        "plans": PLAN_CONFIG,
        "features_comparison": [
            {
                "feature": "Pomodoro RPG e Gamificação (XP, Níveis)",
                "aprendiz_free": "Sim",
                "concurseiro_pro": "Sim"
            },
            {
                "feature": "18 Minijogos do Arcade com Autolimite",
                "aprendiz_free": "Sim",
                "concurseiro_pro": "Sim"
            },
            {
                "feature": "Mentor IA Gemini 2.5 Flash",
                "aprendiz_free": "3 perguntas por dia",
                "concurseiro_pro": "Ilimitado"
            },
            {
                "feature": "Banco de Questões para Concursos",
                "aprendiz_free": "Degustação (até 3 questões)",
                "concurseiro_pro": "Acesso Completo e Ilimitado"
            },
            {
                "feature": "Simulados Cronometrados por Banca (Cebraspe, FGV, FCC)",
                "aprendiz_free": "Bloqueado",
                "concurseiro_pro": "Ilimitado"
            },
            {
                "feature": "Gabaritos Comentados com IA",
                "aprendiz_free": "Bloqueado",
                "concurseiro_pro": "Completo"
            },
            {
                "feature": "Relatórios Avançados e Análise de Assertividade",
                "aprendiz_free": "Básico",
                "concurseiro_pro": "Avançado e por Matéria"
            },
            {
                "feature": "Temas de RPG Raros e Lendários",
                "aprendiz_free": "Básicos",
                "concurseiro_pro": "Todos Desbloqueados"
            }
        ]
    })


@app.route("/api/user/permissions", methods=["GET"])
def get_user_permissions():
    """Retorna as permissões ativas do usuário logado conforme seu plano."""
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result
    return jsonify(user.get_permissions())


@app.route("/api/concurseiro/subjects", methods=["GET"])
def get_concurseiro_subjects_and_bancas():
    """Retorna disciplinas e bancas organizadoras cadastradas no banco de concursos."""
    return jsonify({
        "subjects": concurseiro_bank.get_subjects(),
        "bancas": concurseiro_bank.get_bancas()
    })


@app.route("/api/concurseiro/questions", methods=["GET"])
def get_concurseiro_questions_endpoint():
    """
    Retorna questões do banco de concursos.
    Alunos Free têm acesso a até 3 questões de degustação.
    Concurseiro Pro tem acesso integral ilimitado.
    """
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    subject = request.args.get("subject") or request.args.get("materia")
    banca = request.args.get("banca")
    try:
        limit = int(request.args.get("limit", 10))
    except (ValueError, TypeError):
        limit = 10

    data = concurseiro_bank.get_concurseiro_questions(
        subject=subject,
        banca=banca,
        limit=limit,
        is_premium=user.is_premium
    )
    return jsonify(data)


@app.route("/api/concurseiro/simulado/submit", methods=["POST"])
def submit_concurseiro_simulado():
    """
    Recebe respostas de um simulado de concurso, calcula assertividade e concede XP.
    """
    result = require_auth()
    if isinstance(result, tuple):
        return result
    user = result

    body = request.get_json(silent=True) or {}
    answers = body.get("answers") or []
    if not isinstance(answers, list) or len(answers) == 0:
        return jsonify({"error": "Nenhuma resposta enviada para avaliação."}), 400

    evaluation = concurseiro_bank.evaluate_concurseiro_simulado(answers, is_premium=user.is_premium)

    # Conceder XP com base nos acertos
    xp_awarded = evaluation.get("xp_awarded", 0)
    if xp_awarded > 0:
        stats = get_or_create_stats(user)
        stats.xp += xp_awarded
        evaluation["new_total_xp"] = stats.xp
        evaluation["current_level"] = stats.level

    # Salvar histórico real de simulado no banco de dados
    first_ans = answers[0] if answers and isinstance(answers[0], dict) else {}
    qid = first_ans.get("question_id")
    subject_submitted = "Geral"
    if qid:
        q_obj = next((q for q in concurseiro_bank.CONCURSO_QUESTIONS if q["id"] == qid), None)
        if q_obj:
            subject_submitted = q_obj.get("subject", "Geral")

    try:
        submission = SimuladoHistory(
            user_id=user.id,
            subject=subject_submitted,
            total_questions=evaluation.get("total_questions", 0),
            correct_count=evaluation.get("correct_count", 0),
            accuracy_pct=evaluation.get("accuracy_pct", 0.0),
            xp_awarded=xp_awarded
        )
        db.session.add(submission)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.warning(f"Erro ao salvar histórico de simulado: {e}")

    return jsonify(evaluation)


# ── Frontend (serve as páginas no mesmo host da API) ─────────────────────────
def authorize_emoji_download():
    if not session.get("user_id"):
        raise CacheError(401)


emoji_cache = EmojiCache(
    os.path.join(BASE_DIR, "emoji-cache"),
    os.path.join(FRONTEND_DIR, "assets", "emoji"),
)
app.register_blueprint(create_emoji_blueprint(emoji_cache, authorize_emoji_download))


@app.route("/admin")
def admin_dashboard_page():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.route("/")
def index_page():
    return send_from_directory(FRONTEND_DIR, "landing.html")


@app.route("/planos")
@app.route("/assinatura")
def subscription_page():
    return send_from_directory(FRONTEND_DIR, "assinatura.html")


@app.route("/checkout")
def checkout_page():
    return send_from_directory(FRONTEND_DIR, "checkout.html")



@app.route("/<path:filename>")
def frontend_files(filename):
    target = os.path.join(FRONTEND_DIR, filename)
    if os.path.exists(target):
        return send_from_directory(FRONTEND_DIR, filename)
    # Fallback resiliente para css/ e js/
    if filename.endswith(".css") and os.path.exists(os.path.join(FRONTEND_DIR, "css", filename)):
        return send_from_directory(os.path.join(FRONTEND_DIR, "css"), filename)
    if filename.endswith(".js") and os.path.exists(os.path.join(FRONTEND_DIR, "js"), filename):
        return send_from_directory(os.path.join(FRONTEND_DIR, "js"), filename)
    return send_from_directory(FRONTEND_DIR, filename)


def check_and_apply_db_migrations():
    """Garante que as novas colunas do Google Calendar e OAuth existam no banco de dados."""
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        if "users" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("users")]
            with db.engine.connect() as conn:
                if "google_access_token" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN google_access_token TEXT"))
                if "google_refresh_token" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN google_refresh_token TEXT"))
                if "google_token_expiry" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN google_token_expiry DATETIME"))
                conn.commit()
    except Exception as e:
        app.logger.warning(f"Aviso na migração de colunas Google Calendar: {e}")


# ── Entry point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        try:
            db.create_all()
            check_and_apply_db_migrations()
        except Exception as e:
            print(f"\n[AVISO DE BANCO DE DADOS] Não foi possível executar db.create_all(): {e}")
            if "2003" in str(e) or "10061" in str(e):
                print("[DICA] O serviço MySQL não está rodando localmente na porta 3306.")
                print("[DICA] Em desenvolvimento local, certifique-se de que USE_SQLITE=true esteja no seu arquivo .env.\n")
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))


