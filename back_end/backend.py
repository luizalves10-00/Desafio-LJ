from functools import wraps
from flask import Flask, jsonify, request, session, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime
import os
from google import genai
from dotenv import load_dotenv
from emoji_cache import EmojiCache, CacheError, create_emoji_blueprint

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
    db_uri = os.environ.get("DATABASE_URL")
    if not db_uri:
        if os.environ.get("DB_HOST") or os.environ.get("DB_USER"):
            db_user = os.environ.get("DB_USER", "levelup_user")
            db_pass = os.environ.get("DB_PASS", "levelup_password")
            db_host = os.environ.get("DB_HOST", "127.0.0.1")
            db_port = os.environ.get("DB_PORT", "3306")
            db_name = os.environ.get("DB_NAME", "levelup_db")
            db_uri = f"mysql+pymysql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"
        else:
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

    def to_public(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "interests": self.interests,
            "role": self.role,
            "is_admin": self.is_admin,
            "is_premium": self.is_premium,
            "subscription_status": self.subscription_status,
            "current_period_end": self.current_period_end.isoformat() if self.current_period_end else None,
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
    return jsonify({"user": user.to_public(), "stats": stats.to_dict()}), 201


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
    return jsonify({"user": user.to_public(), "stats": stats.to_dict()})


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

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return jsonify({"suggestion": response.text, "type": "ai"})
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
        return jsonify({"reply": response.text})
    except Exception as e:
        print(f"Erro na API do Gemini: {e}")
        return jsonify({"error": "Erro ao comunicar com a inteligência artificial."}), 500

# ── Frontend (serve as páginas no mesmo host da API) ─────────────────────────
def authorize_emoji_download():
    if not session.get("user_id"):
        raise CacheError(401)


emoji_cache = EmojiCache(
    os.path.join(BASE_DIR, "emoji-cache"),
    os.path.join(FRONTEND_DIR, "assets", "emoji"),
)
app.register_blueprint(create_emoji_blueprint(emoji_cache, authorize_emoji_download))


@app.route("/")
def index_page():
    return send_from_directory(FRONTEND_DIR, "landing.html")


@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


# ── Entry point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            print(f"\n[AVISO DE BANCO DE DADOS] Não foi possível executar db.create_all(): {e}")
            if "2003" in str(e) or "10061" in str(e):
                print("[DICA] O serviço MySQL não está rodando localmente na porta 3306.")
                print("[DICA] Em desenvolvimento local, certifique-se de que USE_SQLITE=true esteja no seu arquivo .env.\n")
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))

