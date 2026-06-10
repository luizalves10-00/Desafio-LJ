from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime
import os

# ── App setup ──────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(BASE_DIR, 'levelupstudy.db')}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

CORS(app, supports_credentials=True, origins=["http://localhost:5500", "http://127.0.0.1:5500", "null"])

db = SQLAlchemy(app)
migrate = Migrate(app, db)

# ── Constants ──────────────────────────────────────────────────────────────
XP_PER_POMODORO = 50
XP_PER_TASK     = 30
XP_PER_LEVEL    = 200

# ── Models ─────────────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = "users"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    email      = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    stats  = db.relationship("UserStats", back_populates="user", uselist=False, cascade="all, delete-orphan")
    tasks  = db.relationship("Task",      back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_public(self) -> dict:
        return {"id": self.id, "name": self.name, "email": self.email}


class UserStats(db.Model):
    __tablename__ = "user_stats"

    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    xp               = db.Column(db.Integer, default=0)
    streak           = db.Column(db.Integer, default=0)
    last_study_date  = db.Column(db.String(10), nullable=True)
    total_pomodoros  = db.Column(db.Integer, default=0)

    user = db.relationship("User", back_populates="stats")

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
    name     = (body.get("name") or "").strip()
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Nome, e-mail e senha são obrigatórios"}), 400
    if len(password) < 6:
        return jsonify({"error": "A senha deve ter pelo menos 6 caracteres"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "E-mail já cadastrado"}), 409

    user = User(name=name, email=email)
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
    return jsonify(stats.to_dict())


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
    stats.xp += XP_PER_TASK
    db.session.commit()

    return jsonify({
        "xp_gained":      XP_PER_TASK,
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


# ── Entry point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
