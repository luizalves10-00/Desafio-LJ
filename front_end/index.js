const API = "http://localhost:5000/api";

// ── STATE ──────────────────────────────────────────────────────────────────
let focusMins = 25, breakMins = 5;
let totalSecs = focusMins * 60;
let secondsLeft = totalSecs;
let isBreak = false;
let running = false;
let interval = null;
let pomodorosDone = 0;
let statusData = {};

// ── NAVIGATION ──────────────────────────────────────────────────────────────
const SECTION_TITLES = {
  dashboard:  "Dashboard",
  pomodoro:   "Pomodoro",
  tarefas:    "Tarefas",
  conquistas: "Conquistas",
  jogos:      "Jogos",
  temas:      "Temas",
};

function navigate(name, btn) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("section-" + name).classList.add("active");
  btn.classList.add("active");
  document.getElementById("topbar-title").textContent = SECTION_TITLES[name];
  closeSidebar();
  if (name === "tarefas")    loadTasks();
  if (name === "conquistas") renderAchievements();
  if (name === "dashboard")  loadSuggest();
  if (name === "jogos")      snakeReset();
}

// ── SIDEBAR MOBILE ─────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

// ── THEMES ─────────────────────────────────────────────────────────────────
const THEMES = ["dark","ocean","forest","sunset","light","midnight"];

function setTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem("lus-theme", name);
  THEMES.forEach(t => {
    document.getElementById("theme-" + t).classList.toggle("active", t === name);
    document.getElementById("check-" + t).textContent = t === name ? "✓" : "";
  });
  showToast("Tema " + name + " aplicado!", "");
}

function loadTheme() {
  const saved = localStorage.getItem("lus-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  THEMES.forEach(t => {
    document.getElementById("theme-" + t).classList.toggle("active", t === saved);
    document.getElementById("check-" + t).textContent = t === saved ? "✓" : "";
  });
}

// ── TIMER ──────────────────────────────────────────────────────────────────
function setDuration(focus, brk) {
  focusMins = focus; breakMins = brk;
  resetTimer();
}

const RING_MINI_CIRC = 402.1;
const RING_FULL_CIRC = 603.2;

function updateDisplay() {
  const m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const s = String(secondsLeft % 60).padStart(2, "0");
  const timeStr = `${m}:${s}`;
  const modeStr = isBreak ? "PAUSA" : "FOCO";
  const modeStrFull = isBreak ? "⛹ PAUSA — DESCANSE!" : "🧠 SESSÃO DE FOCO";
  const breakCls = isBreak ? " break" : "";

  const d = document.getElementById("timer-display");
  if (d) { d.textContent = timeStr; d.className = "timer-display" + breakCls; }
  const dm = document.getElementById("timer-mode");
  if (dm) dm.textContent = modeStr;

  const df = document.getElementById("timer-display-full");
  if (df) { df.textContent = timeStr; df.className = "timer-display" + breakCls; }
  const dmf = document.getElementById("timer-mode-full");
  if (dmf) dmf.textContent = modeStrFull;

  const pct = secondsLeft / totalSecs;
  const offsetMini = RING_MINI_CIRC * (1 - pct);
  const offsetFull = RING_FULL_CIRC * (1 - pct);

  const rMini = document.getElementById("ring-fill");
  if (rMini) { rMini.style.strokeDashoffset = offsetMini; rMini.className = "ring-fill" + breakCls; }
  const rFull = document.getElementById("ring-fill-full");
  if (rFull) { rFull.style.strokeDashoffset = offsetFull; rFull.className = "ring-fill" + breakCls; }

  const bt = document.getElementById("break-timer");
  if (bt) bt.textContent = timeStr;
}

function startTimer() {
  if (running) return;
  running = true;
  setSyncBtns(true);
  interval = setInterval(tick, 1000);
}
function pauseTimer() {
  running = false;
  clearInterval(interval);
  setSyncBtns(false);
}
function resetTimer() {
  pauseTimer();
  isBreak = false;
  totalSecs = focusMins * 60;
  secondsLeft = totalSecs;
  updateDisplay();
}
function setSyncBtns(isRunning) {
  ["", "-full"].forEach(suffix => {
    const s = document.getElementById("btn-start" + suffix);
    const p = document.getElementById("btn-pause" + suffix);
    if (s) s.disabled = isRunning;
    if (p) p.disabled = !isRunning;
  });
}

function tick() {
  if (secondsLeft <= 0) {
    clearInterval(interval);
    running = false;
    setSyncBtns(false);
    if (!isBreak) {
      pomodorosDone++;
      renderDots();
      completePomodoro();
      isBreak = true;
      totalSecs = breakMins * 60;
      secondsLeft = totalSecs;
      showToast("🍅 Pomodoro concluído! Descanse jogando.", "gold");
      playBeep(880);
      openBreakModal();
    } else {
      isBreak = false;
      totalSecs = focusMins * 60;
      secondsLeft = totalSecs;
      showToast("🚀 Pausa encerrada! Volte ao foco.", "");
      playBeep(440);
      closeBreakModal();
    }
    updateDisplay();
    startTimer();
    return;
  }
  secondsLeft--;
  updateDisplay();
}

function playBeep(freq) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.start();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.stop(ctx.currentTime + 0.6);
  } catch(e) {}
}

function renderDots() {
  ["pom-dots", "pom-dots-full"].forEach(id => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const d = document.createElement("div");
      d.className = "pom-dot" + (i < pomodorosDone % 4 ? " done" : "");
      wrap.appendChild(d);
    }
  });
}

["", "-full"].forEach(suffix => {
  const s = document.getElementById("btn-start" + suffix);
  const p = document.getElementById("btn-pause" + suffix);
  const r = document.getElementById("btn-reset" + suffix);
  if (s) s.addEventListener("click", startTimer);
  if (p) p.addEventListener("click", pauseTimer);
  if (r) r.addEventListener("click", resetTimer);
});

// ── API HELPERS ────────────────────────────────────────────────────────────
function apiFetch(url, opts = {}) {
  return fetch(url, { credentials: "include", ...opts });
}

async function completePomodoro() {
  try {
    const res = await apiFetch(`${API}/pomodoro/complete`, { method: "POST" });
    if (res.status === 401) { redirectLogin(); return; }
    const d = await res.json();
    showToast(`+${d.xp_gained} XP ganhos! 🔥 Streak: ${d.streak} dias`, "gold");
    loadStatus();
  } catch(e) {}
}

async function loadStatus() {
  try {
    const res = await apiFetch(`${API}/status`);
    if (res.status === 401) { redirectLogin(); return; }
    statusData = await res.json();
    document.getElementById("sb-level").textContent = `Nível ${statusData.level}`;
    document.getElementById("sb-xp").textContent = `${statusData.xp} XP`;
    document.getElementById("sb-xp-fill").style.width = statusData.xp_progress_pct + "%";
    document.getElementById("sb-xp-next").textContent = `${statusData.xp_to_next} XP para o próximo nível`;
    document.getElementById("sb-streak").textContent = `🔥 ${statusData.streak} dia${statusData.streak !== 1 ? "s" : ""} de streak`;
    document.getElementById("d-level").textContent = statusData.level;
    document.getElementById("d-xp").textContent = statusData.xp;
    document.getElementById("d-streak").textContent = statusData.streak;
    document.getElementById("p-total-pom").textContent = statusData.total_pomodoros;
    document.getElementById("p-xp").textContent = statusData.xp + " XP";
    document.getElementById("p-mins").textContent = (statusData.total_pomodoros * focusMins) + " min";
    renderAchievements();
  } catch(e) {}
}

async function loadTasks() {
  try {
    const res = await apiFetch(`${API}/tasks`);
    if (res.status === 401) { redirectLogin(); return; }
    renderTasks(await res.json());
  } catch(e) {}
}

async function addTask() {
  const title = document.getElementById("task-title").value.trim();
  if (!title) { showToast("Digite o nome da tarefa!", ""); return; }
  const body = {
    title,
    subject:  document.getElementById("task-subject").value.trim(),
    due_date: document.getElementById("task-due").value,
    priority: document.getElementById("task-priority").value,
  };
  try {
    await apiFetch(`${API}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    document.getElementById("task-title").value = "";
    document.getElementById("task-subject").value = "";
    document.getElementById("task-due").value = "";
    loadTasks();
    loadSuggest();
    showToast("Tarefa adicionada! ✓", "green");
  } catch(e) {}
}

async function completeTask(id) {
  try {
    const res = await apiFetch(`${API}/tasks/${id}/complete`, { method: "POST" });
    const d = await res.json();
    showToast(`✅ Tarefa concluída! +${d.xp_gained} XP`, "gold");
    loadTasks(); loadStatus(); loadSuggest();
  } catch(e) {}
}

async function deleteTask(id) {
  try {
    await apiFetch(`${API}/tasks/${id}`, { method: "DELETE" });
    loadTasks(); loadSuggest();
  } catch(e) {}
}

async function loadSuggest() {
  try {
    const res = await apiFetch(`${API}/suggest`);
    if (res.status === 401) return;
    const d = await res.json();
    if (d.suggestion) {
      document.getElementById("suggest-title").textContent = d.suggestion.title;
      document.getElementById("suggest-body").textContent = d.suggestion.subject
        ? `📚 Matéria: ${d.suggestion.subject}` : "Sem matéria específica";
      document.getElementById("suggest-meta").textContent = d.suggestion.due_date
        ? `📅 Prazo: ${formatDate(d.suggestion.due_date)}` : "";
    } else {
      document.getElementById("suggest-title").textContent = "🎉 Tudo em dia!";
      document.getElementById("suggest-body").textContent = d.message;
      document.getElementById("suggest-meta").textContent = "";
    }
  } catch(e) {}
}

async function logout() {
  await apiFetch(`${API}/auth/logout`, { method: "POST" });
  redirectLogin();
}

function redirectLogin() { window.location.href = "login.html"; }

// ── RENDER ─────────────────────────────────────────────────────────────────
const PRIORITY_LABELS = { 1: ["Alta", "p1"], 2: ["Média", "p2"], 3: ["Baixa", "p3"] };

function renderTasks(tasks) {
  const list = document.getElementById("task-list");
  if (!tasks.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>Nenhuma tarefa ainda. Adicione sua primeira!</div>`;
    return;
  }
  list.innerHTML = tasks.map(t => {
    const [plabel, pcls] = PRIORITY_LABELS[t.priority] || ["Média", "p2"];
    const due = t.due_date ? ` · Prazo: ${formatDate(t.due_date)}` : "";
    return `
      <div class="task-item ${t.done ? "done" : ""}">
        <div class="task-info">
          <div class="task-title">${esc(t.title)}</div>
          <div class="task-meta">${esc(t.subject || "Sem matéria")}${due}</div>
        </div>
        <span class="priority-badge ${pcls}">${plabel}</span>
        <div class="task-actions">
          ${!t.done ? `<button class="btn btn-green btn-sm" onclick="completeTask(${t.id})">✓</button>` : ""}
          <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">✕</button>
        </div>
      </div>`;
  }).join("");
}

const BADGES = [
  { id: "first_pom",  icon: "🍅", name: "Primeiro Pomodoro", desc: "Complete 1 pomodoro",  cond: d => d.total_pomodoros >= 1  },
  { id: "pom5",       icon: "🔥", name: "Em Chamas",         desc: "5 pomodoros",          cond: d => d.total_pomodoros >= 5  },
  { id: "pom20",      icon: "💪", name: "Dedicação",         desc: "20 pomodoros",         cond: d => d.total_pomodoros >= 20 },
  { id: "pom50",      icon: "🚀", name: "Maratonista",       desc: "50 pomodoros",         cond: d => d.total_pomodoros >= 50 },
  { id: "streak3",    icon: "⚡", name: "Streak 3 dias",     desc: "3 dias seguidos",      cond: d => d.streak >= 3  },
  { id: "streak7",    icon: "🌟", name: "Semana Perfeita",   desc: "7 dias seguidos",      cond: d => d.streak >= 7  },
  { id: "streak30",   icon: "👑", name: "Mês de Ouro",       desc: "30 dias seguidos",     cond: d => d.streak >= 30 },
  { id: "level5",     icon: "🏆", name: "Nível 5",           desc: "Alcance o nível 5",    cond: d => d.level >= 5   },
  { id: "level10",    icon: "💎", name: "Nível 10",          desc: "Alcance o nível 10",   cond: d => d.level >= 10  },
  { id: "xp500",      icon: "✨", name: "500 XP",            desc: "Acumule 500 XP",       cond: d => d.xp >= 500    },
  { id: "xp2000",     icon: "🌈", name: "2000 XP",           desc: "Acumule 2000 XP",      cond: d => d.xp >= 2000   },
];

function renderAchievements() {
  const grid = document.getElementById("badges-grid");
  if (!grid) return;
  grid.innerHTML = BADGES.map(b => {
    const unlocked = b.cond(statusData);
    return `<div class="badge ${unlocked ? "unlocked" : ""}">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
    </div>`;
  }).join("");
}

// ── TOAST ──────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.innerHTML = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── UTILS ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function formatDate(s) {
  if (!s) return "";
  const [y,m,d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function setTopbarDate() {
  const now = new Date();
  document.getElementById("topbar-date").textContent =
    now.toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long" });
}

// ── BREAK MODAL ──────────────────────────────────────────────────────────────
function openBreakModal() {
  document.getElementById("break-modal").classList.add("show");
  snakeReset();
}
function closeBreakModal() {
  document.getElementById("break-modal").classList.remove("show");
  snakeStop();
}

// ── SNAKE GAME ───────────────────────────────────────────────────────────────
const SNAKE_GRID = 16;          // 16 x 16 células
const SNAKE_SPEED = 130;        // ms por passo

let snakeBody = [];
let snakeDir = { x: 1, y: 0 };
let snakeNextDir = { x: 1, y: 0 };
let snakeFood = { x: 8, y: 8 };
let snakeScore = 0;
let snakeBest = parseInt(localStorage.getItem("lus-snake-best") || "0", 10);
let snakeLoop = null;
let snakeRunning = false;

// Descobre qual canvas está visível (modal tem prioridade)
function snakeTargets() {
  const modalOpen = document.getElementById("break-modal").classList.contains("show");
  const suffix = modalOpen ? "-modal" : "";
  return {
    canvas:     document.getElementById("snake-canvas" + suffix),
    scoreEl:    document.getElementById("snake-score" + suffix),
    bestEl:     document.getElementById("snake-best" + suffix),
    overlay:    document.getElementById("snake-overlay" + suffix),
    overlayMsg: document.getElementById("snake-overlay-msg" + suffix),
  };
}

function snakeReset() {
  snakeStop();
  snakeBody = [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }];
  snakeDir = { x: 1, y: 0 };
  snakeNextDir = { x: 1, y: 0 };
  snakeScore = 0;
  snakePlaceFood();
  const t = snakeTargets();
  if (t.scoreEl) t.scoreEl.textContent = "0";
  if (t.bestEl)  t.bestEl.textContent = snakeBest;
  if (t.overlay) {
    t.overlay.classList.remove("hidden");
    if (t.overlayMsg) t.overlayMsg.textContent = "Pronto para jogar? 🐍";
  }
  snakeDraw();
}

function snakeStart() {
  if (snakeRunning) return;
  // se veio de game over, reinicia
  if (snakeBody.length === 0) snakeReset();
  snakeRunning = true;
  const t = snakeTargets();
  if (t.overlay) t.overlay.classList.add("hidden");
  snakeLoop = setInterval(snakeStep, SNAKE_SPEED);
}

function snakeStop() {
  snakeRunning = false;
  if (snakeLoop) { clearInterval(snakeLoop); snakeLoop = null; }
}

function snakeSetDir(dir) {
  const map = {
    up:    { x: 0, y: -1 },
    down:  { x: 0, y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const nd = map[dir];
  if (!nd) return;
  // impede inverter 180°
  if (nd.x === -snakeDir.x && nd.y === -snakeDir.y) return;
  snakeNextDir = nd;
}

function snakePlaceFood() {
  let ok = false;
  while (!ok) {
    snakeFood = {
      x: Math.floor(Math.random() * SNAKE_GRID),
      y: Math.floor(Math.random() * SNAKE_GRID),
    };
    ok = !snakeBody.some(s => s.x === snakeFood.x && s.y === snakeFood.y);
  }
}

function snakeStep() {
  snakeDir = snakeNextDir;
  const head = {
    x: snakeBody[0].x + snakeDir.x,
    y: snakeBody[0].y + snakeDir.y,
  };

  // colisão com parede ou corpo → game over
  const hitWall = head.x < 0 || head.y < 0 || head.x >= SNAKE_GRID || head.y >= SNAKE_GRID;
  const hitSelf = snakeBody.some(s => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) {
    snakeGameOver();
    return;
  }

  snakeBody.unshift(head);

  // comeu fruta
  if (head.x === snakeFood.x && head.y === snakeFood.y) {
    snakeScore += 10;
    const t = snakeTargets();
    if (t.scoreEl) t.scoreEl.textContent = snakeScore;
    if (snakeScore > snakeBest) {
      snakeBest = snakeScore;
      localStorage.setItem("lus-snake-best", snakeBest);
      if (t.bestEl) t.bestEl.textContent = snakeBest;
    }
    playBeep(660);
    snakePlaceFood();
  } else {
    snakeBody.pop();
  }

  snakeDraw();
}

function snakeGameOver() {
  snakeStop();
  const t = snakeTargets();
  if (t.overlay) {
    t.overlay.classList.remove("hidden");
    if (t.overlayMsg) t.overlayMsg.textContent = `💀 Game over! Pontos: ${snakeScore}`;
  }
  snakeBody = [];
  playBeep(200);
}

function snakeDraw() {
  const t = snakeTargets();
  if (!t.canvas) return;
  const ctx = t.canvas.getContext("2d");
  const size = t.canvas.width;
  const cell = size / SNAKE_GRID;

  // cores do tema atual
  const css = getComputedStyle(document.documentElement);
  const bg     = css.getPropertyValue("--surface2").trim() || "#16213e";
  const accent = css.getPropertyValue("--accent2").trim()  || "#a855f7";
  const accent1 = css.getPropertyValue("--accent").trim()  || "#7c3aed";
  const red    = css.getPropertyValue("--red").trim()      || "#ef4444";

  // fundo
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // grade leve
  ctx.strokeStyle = "rgba(255,255,255,.03)";
  ctx.lineWidth = 1;
  for (let i = 1; i < SNAKE_GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
  }

  // fruta
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.arc(snakeFood.x * cell + cell / 2, snakeFood.y * cell + cell / 2, cell / 2.6, 0, Math.PI * 2);
  ctx.fill();

  // cobra
  snakeBody.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? accent : accent1;
    const pad = 1.5;
    roundRect(ctx, s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, 4);
    ctx.fill();
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// teclado
document.addEventListener("keydown", (e) => {
  const keys = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
  };
  const dir = keys[e.key];
  if (dir && snakeRunning) { e.preventDefault(); snakeSetDir(dir); }
});

// ── INIT ───────────────────────────────────────────────────────────────────
async function init() {
  loadTheme();
  setTopbarDate();
  try {
    const res = await apiFetch(`${API}/auth/me`);
    if (res.status === 401) { redirectLogin(); return; }
    const { user } = await res.json();
    document.getElementById("sb-name").textContent = user.name;
    document.getElementById("sb-email").textContent = user.email;
    document.getElementById("sb-avatar").textContent = user.name.charAt(0).toUpperCase();
  } catch {
    redirectLogin();
    return;
  }
  updateDisplay();
  renderDots();
  loadStatus();
  loadSuggest();
  snakeReset();
}

init();
