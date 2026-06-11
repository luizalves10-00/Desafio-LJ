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
  if (name === "jogos")      startCurrentGame();
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

// ── SELETOR DE JOGOS ─────────────────────────────────────────────────────────
let currentGame = "snake";

function selectGame(name, btn) {
  currentGame = name;
  const inModal = !!btn.closest(".break-modal");
  const suffix = inModal ? "-modal" : "";
  // troca aba ativa no grupo clicado
  btn.parentElement.querySelectorAll(".game-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.game === name));
  // troca painel ativo na localização correta
  ["snake","2048","memoria","minado","velha","desliza","wordle"].forEach(g => {
    const pane = document.getElementById("game-pane-" + g + suffix);
    if (pane) pane.classList.toggle("active", g === name);
  });
  stopAllGames();
  startCurrentGame();
}

function stopAllGames() {
  snakeStop();
}

function startCurrentGame() {
  if (currentGame === "snake")        snakeReset();
  else if (currentGame === "2048")    g2048Start();
  else if (currentGame === "memoria") memStart();
  else if (currentGame === "minado")  mineStart();
  else if (currentGame === "velha")   velhaStart();
  else if (currentGame === "desliza") deslizaStart();
  else if (currentGame === "wordle")  wordleStart();
}

// helpers genéricos: resolvem o elemento da localização ativa (seção ou modal)
function gameSuffix() {
  return document.getElementById("break-modal").classList.contains("show") ? "-modal" : "";
}
function gel(baseId) {
  return document.getElementById(baseId + gameSuffix());
}

// ── BREAK MODAL ──────────────────────────────────────────────────────────────
function openBreakModal() {
  document.getElementById("break-modal").classList.add("show");
  // sincroniza abas/painéis do modal com o jogo atual
  document.querySelectorAll("#game-tabs-modal .game-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.game === currentGame));
  ["snake","2048","memoria","minado","velha","desliza","wordle"].forEach(g => {
    const pane = document.getElementById("game-pane-" + g + "-modal");
    if (pane) pane.classList.toggle("active", g === currentGame);
  });
  startCurrentGame();
}
function closeBreakModal() {
  document.getElementById("break-modal").classList.remove("show");
  stopAllGames();
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

// teclado — roteia para o jogo atual
document.addEventListener("keydown", (e) => {
  const keys = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right",
  };
  const dir = keys[e.key];
  if (!dir) return;
  if (currentGame === "snake" && snakeRunning) { e.preventDefault(); snakeSetDir(dir); }
  else if (currentGame === "2048") { e.preventDefault(); g2048Move(dir); }
  else if (currentGame === "desliza") { e.preventDefault(); deslizaArrow(dir); }
});

// ── 2048 ─────────────────────────────────────────────────────────────────────
let g2048Grid = [];
let g2048Score = 0;
let g2048Best = parseInt(localStorage.getItem("lus-2048-best") || "0", 10);
let g2048Over = false;
let g2048LastAdded = null;

function g2048Targets() {
  const modalOpen = document.getElementById("break-modal").classList.contains("show");
  const suffix = modalOpen ? "-modal" : "";
  return {
    board:      document.getElementById("g2048-board" + suffix),
    scoreEl:    document.getElementById("g2048-score" + suffix),
    bestEl:     document.getElementById("g2048-best" + suffix),
    overlay:    document.getElementById("g2048-overlay" + suffix),
    overlayMsg: document.getElementById("g2048-overlay-msg" + suffix),
  };
}

function g2048Start() {
  g2048Grid = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  g2048Score = 0;
  g2048Over = false;
  g2048AddTile();
  g2048AddTile();
  const t = g2048Targets();
  if (t.overlay) t.overlay.classList.add("hidden");
  g2048Render();
}

function g2048AddTile() {
  const empty = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      if (g2048Grid[i][j] === 0) empty.push([i, j]);
  if (!empty.length) return;
  const [i, j] = empty[Math.floor(Math.random() * empty.length)];
  g2048Grid[i][j] = Math.random() < 0.9 ? 2 : 4;
  g2048LastAdded = i * 4 + j;
}

function g2048Slide(line) {
  let arr = line.filter(v => v);
  let gained = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      gained += arr[i];
      arr.splice(i + 1, 1);
    }
  }
  while (arr.length < 4) arr.push(0);
  return { line: arr, gained };
}

function g2048Move(dir) {
  if (g2048Over) return;
  const before = JSON.stringify(g2048Grid);
  let gained = 0;
  for (let i = 0; i < 4; i++) {
    let line = [];
    for (let j = 0; j < 4; j++) {
      if (dir === "left")       line.push(g2048Grid[i][j]);
      else if (dir === "right") line.push(g2048Grid[i][3 - j]);
      else if (dir === "up")    line.push(g2048Grid[j][i]);
      else                      line.push(g2048Grid[3 - j][i]);
    }
    const r = g2048Slide(line);
    gained += r.gained;
    line = r.line;
    for (let j = 0; j < 4; j++) {
      if (dir === "left")       g2048Grid[i][j] = line[j];
      else if (dir === "right") g2048Grid[i][3 - j] = line[j];
      else if (dir === "up")    g2048Grid[j][i] = line[j];
      else                      g2048Grid[3 - j][i] = line[j];
    }
  }
  if (JSON.stringify(g2048Grid) === before) return; // nada mudou

  g2048Score += gained;
  if (g2048Score > g2048Best) {
    g2048Best = g2048Score;
    localStorage.setItem("lus-2048-best", g2048Best);
  }
  g2048AddTile();
  if (gained > 0) playBeep(620);
  g2048Render();

  if (g2048HasWon())       g2048End("🎉 Você chegou no 2048!");
  else if (g2048IsStuck()) g2048End("💀 Fim de jogo! Pontos: " + g2048Score);
}

function g2048HasWon() {
  return g2048Grid.some(row => row.some(v => v >= 2048));
}

function g2048IsStuck() {
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      if (g2048Grid[i][j] === 0) return false;
      if (j < 3 && g2048Grid[i][j] === g2048Grid[i][j + 1]) return false;
      if (i < 3 && g2048Grid[i][j] === g2048Grid[i + 1][j]) return false;
    }
  return true;
}

function g2048End(msg) {
  g2048Over = true;
  const t = g2048Targets();
  if (t.overlay) {
    t.overlay.classList.remove("hidden");
    if (t.overlayMsg) t.overlayMsg.textContent = msg;
  }
  playBeep(g2048HasWon() ? 880 : 200);
}

function g2048Render() {
  const t = g2048Targets();
  if (!t.board) return;
  t.board.innerHTML = "";
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const v = g2048Grid[i][j];
      const cell = document.createElement("div");
      cell.className = "g2048-cell";
      if (v) {
        cell.dataset.v = v;
        cell.textContent = v;
        if (i * 4 + j === g2048LastAdded) cell.classList.add("pop");
      }
      t.board.appendChild(cell);
    }
  if (t.scoreEl) t.scoreEl.textContent = g2048Score;
  if (t.bestEl)  t.bestEl.textContent = g2048Best;
}

// ── JOGO DA MEMÓRIA ──────────────────────────────────────────────────────────
const MEM_EMOJIS = ["🍎", "🚀", "⭐", "🔥", "💎", "🎯", "🧠", "🏆"];
let memCards = [];
let memFirst = null;
let memLock = false;
let memMoves = 0;
let memPairs = 0;

function memTargets() {
  const modalOpen = document.getElementById("break-modal").classList.contains("show");
  const suffix = modalOpen ? "-modal" : "";
  return {
    grid:       document.getElementById("mem-grid" + suffix),
    movesEl:    document.getElementById("mem-moves" + suffix),
    pairsEl:    document.getElementById("mem-pairs" + suffix),
    overlay:    document.getElementById("mem-overlay" + suffix),
    overlayMsg: document.getElementById("mem-overlay-msg" + suffix),
  };
}

function memStart() {
  const deck = [...MEM_EMOJIS, ...MEM_EMOJIS]
    .map(e => ({ emoji: e, flipped: false, matched: false }));
  // embaralha (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  memCards = deck;
  memFirst = null;
  memLock = false;
  memMoves = 0;
  memPairs = 0;
  const t = memTargets();
  if (t.overlay) t.overlay.classList.add("hidden");
  memRender();
}

function memRender() {
  const t = memTargets();
  if (!t.grid) return;
  t.grid.innerHTML = "";
  memCards.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "mem-card" + (c.flipped ? " flipped" : "") + (c.matched ? " matched" : "");
    div.innerHTML = `<span class="mem-face">${c.emoji}</span>`;
    div.onclick = () => memFlip(i);
    t.grid.appendChild(div);
  });
  if (t.movesEl) t.movesEl.textContent = memMoves;
  if (t.pairsEl) t.pairsEl.textContent = memPairs + "/8";
}

function memFlip(i) {
  if (memLock) return;
  const card = memCards[i];
  if (card.flipped || card.matched) return;

  card.flipped = true;
  memRender();

  if (memFirst === null) {
    memFirst = i;
    return;
  }

  memMoves++;
  const first = memCards[memFirst];
  if (first.emoji === card.emoji) {
    first.matched = true;
    card.matched = true;
    memPairs++;
    memFirst = null;
    playBeep(660);
    memRender();
    if (memPairs === 8) memWin();
  } else {
    memLock = true;
    memRender();
    setTimeout(() => {
      first.flipped = false;
      card.flipped = false;
      memFirst = null;
      memLock = false;
      memRender();
    }, 750);
  }
}

function memWin() {
  const t = memTargets();
  if (t.overlay) {
    t.overlay.classList.remove("hidden");
    if (t.overlayMsg) t.overlayMsg.textContent = `🎉 Você venceu em ${memMoves} jogadas!`;
  }
  playBeep(880);
}

// ── CAMPO MINADO ─────────────────────────────────────────────────────────────
const MINE_SIZE = 9;
const MINE_TOTAL = 10;
let mineGrid = [];        // {mine, revealed, flag, n}
let mineFlagMode = false;
let mineOver = false;
let mineRevealedCount = 0;

function mineStart() {
  mineOver = false;
  mineRevealedCount = 0;
  mineGrid = [];
  for (let i = 0; i < MINE_SIZE * MINE_SIZE; i++)
    mineGrid.push({ mine: false, revealed: false, flag: false, n: 0 });
  // posiciona minas
  let placed = 0;
  while (placed < MINE_TOTAL) {
    const idx = Math.floor(Math.random() * mineGrid.length);
    if (!mineGrid[idx].mine) { mineGrid[idx].mine = true; placed++; }
  }
  // calcula números
  for (let i = 0; i < mineGrid.length; i++) {
    if (mineGrid[i].mine) continue;
    mineGrid[i].n = mineNeighbors(i).filter(j => mineGrid[j].mine).length;
  }
  const ov = gel("mine-overlay");
  if (ov) ov.classList.add("hidden");
  const st = gel("mine-status");
  if (st) st.textContent = "🙂";
  const cnt = gel("mine-count");
  if (cnt) cnt.textContent = MINE_TOTAL;
  mineRender();
}

function mineNeighbors(idx) {
  const r = Math.floor(idx / MINE_SIZE), c = idx % MINE_SIZE;
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < MINE_SIZE && nc >= 0 && nc < MINE_SIZE)
        out.push(nr * MINE_SIZE + nc);
    }
  return out;
}

function mineToggleFlag() {
  mineFlagMode = !mineFlagMode;
  ["mine-flag-btn", "mine-flag-btn-modal"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.textContent = `🚩 Bandeira: ${mineFlagMode ? "ON" : "OFF"}`;
  });
}

function mineClick(idx) {
  if (mineOver) return;
  const cell = mineGrid[idx];
  if (mineFlagMode) {
    if (!cell.revealed) cell.flag = !cell.flag;
    mineRender();
    return;
  }
  if (cell.flag || cell.revealed) return;
  if (cell.mine) { mineLose(); return; }
  mineReveal(idx);
  if (mineRevealedCount === mineGrid.length - MINE_TOTAL) mineWin();
  mineRender();
}

function mineReveal(idx) {
  const cell = mineGrid[idx];
  if (cell.revealed || cell.flag || cell.mine) return;
  cell.revealed = true;
  mineRevealedCount++;
  if (cell.n === 0) mineNeighbors(idx).forEach(mineReveal); // flood fill
}

function mineLose() {
  mineOver = true;
  mineGrid.forEach(c => { if (c.mine) c.revealed = true; });
  const st = gel("mine-status"); if (st) st.textContent = "💥";
  mineRender();
  const ov = gel("mine-overlay"), msg = gel("mine-overlay-msg");
  if (ov) ov.classList.remove("hidden");
  if (msg) msg.textContent = "💣 Boom! Você perdeu.";
  playBeep(200);
}

function mineWin() {
  mineOver = true;
  const st = gel("mine-status"); if (st) st.textContent = "😎";
  const ov = gel("mine-overlay"), msg = gel("mine-overlay-msg");
  if (ov) ov.classList.remove("hidden");
  if (msg) msg.textContent = "🎉 Você limpou o campo!";
  playBeep(880);
}

function mineRender() {
  const grid = gel("mine-grid");
  if (!grid) return;
  grid.innerHTML = "";
  mineGrid.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "mine-cell";
    if (c.revealed) {
      div.classList.add("revealed");
      if (c.mine) { div.classList.add("mine"); div.textContent = "💣"; }
      else if (c.n > 0) { div.dataset.n = c.n; div.textContent = c.n; }
    } else if (c.flag) {
      div.classList.add("flag");
      div.textContent = "🚩";
    }
    div.onclick = () => mineClick(i);
    div.oncontextmenu = (e) => { e.preventDefault(); if (!mineOver && !c.revealed) { c.flag = !c.flag; mineRender(); } };
    grid.appendChild(div);
  });
}

// ── JOGO DA VELHA ────────────────────────────────────────────────────────────
let velhaBoard = [];
let velhaOver = false;
let velhaWins = parseInt(localStorage.getItem("lus-velha-wins") || "0", 10);
let velhaLosses = parseInt(localStorage.getItem("lus-velha-losses") || "0", 10);
const VELHA_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function velhaStart() {
  velhaBoard = Array(9).fill("");
  velhaOver = false;
  const ov = gel("velha-overlay");
  if (ov) ov.classList.add("hidden");
  velhaUpdateStats();
  velhaRender();
}

function velhaUpdateStats() {
  const w = gel("velha-wins"), l = gel("velha-losses");
  if (w) w.textContent = velhaWins;
  if (l) l.textContent = velhaLosses;
}

function velhaClick(i) {
  if (velhaOver || velhaBoard[i]) return;
  velhaBoard[i] = "❌";
  playBeep(520);
  if (velhaCheckEnd()) return;
  // jogada da CPU
  const move = velhaBestMove();
  if (move != null) velhaBoard[move] = "⭕";
  velhaCheckEnd();
  velhaRender();
}

function velhaWinner(b) {
  for (const [a, c, d] of VELHA_LINES)
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line: [a, c, d] };
  return null;
}

function velhaCheckEnd() {
  const win = velhaWinner(velhaBoard);
  if (win) {
    velhaOver = true;
    if (win.who === "❌") { velhaWins++; localStorage.setItem("lus-velha-wins", velhaWins); }
    else { velhaLosses++; localStorage.setItem("lus-velha-losses", velhaLosses); }
    velhaUpdateStats();
    velhaRender(win.line);
    const ov = gel("velha-overlay"), msg = gel("velha-overlay-msg");
    if (ov) ov.classList.remove("hidden");
    if (msg) msg.textContent = win.who === "❌" ? "🎉 Você venceu!" : "🤖 A CPU venceu!";
    playBeep(win.who === "❌" ? 880 : 200);
    return true;
  }
  if (velhaBoard.every(v => v)) {
    velhaOver = true;
    const ov = gel("velha-overlay"), msg = gel("velha-overlay-msg");
    if (ov) ov.classList.remove("hidden");
    if (msg) msg.textContent = "🤝 Deu velha (empate)!";
    return true;
  }
  return false;
}

// IA: minimax simples
function velhaBestMove() {
  let bestScore = -Infinity, best = null;
  for (let i = 0; i < 9; i++) {
    if (!velhaBoard[i]) {
      velhaBoard[i] = "⭕";
      const score = velhaMinimax(velhaBoard, 0, false);
      velhaBoard[i] = "";
      if (score > bestScore) { bestScore = score; best = i; }
    }
  }
  return best;
}

function velhaMinimax(b, depth, isMax) {
  const win = velhaWinner(b);
  if (win) return win.who === "⭕" ? 10 - depth : depth - 10;
  if (b.every(v => v)) return 0;
  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++)
      if (!b[i]) { b[i] = "⭕"; best = Math.max(best, velhaMinimax(b, depth + 1, false)); b[i] = ""; }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++)
      if (!b[i]) { b[i] = "❌"; best = Math.min(best, velhaMinimax(b, depth + 1, true)); b[i] = ""; }
    return best;
  }
}

function velhaRender(winLine) {
  const grid = gel("velha-grid");
  if (!grid) return;
  grid.innerHTML = "";
  velhaBoard.forEach((v, i) => {
    const div = document.createElement("div");
    div.className = "velha-cell" + (v ? " filled" : "") + (winLine && winLine.includes(i) ? " win" : "");
    div.textContent = v;
    div.onclick = () => velhaClick(i);
    grid.appendChild(div);
  });
}

// ── QUEBRA-CABEÇA DESLIZANTE ─────────────────────────────────────────────────
let deslizaTiles = [];   // 0..15, 0 = vazio
let deslizaMoves = 0;

function deslizaStart() {
  // gera embaralhamento resolvível
  do {
    deslizaTiles = [...Array(16).keys()]; // 0..15
    for (let i = deslizaTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deslizaTiles[i], deslizaTiles[j]] = [deslizaTiles[j], deslizaTiles[i]];
    }
  } while (!deslizaSolvable(deslizaTiles) || deslizaWon());
  deslizaMoves = 0;
  const ov = gel("desliza-overlay");
  if (ov) ov.classList.add("hidden");
  deslizaRender();
}

function deslizaSolvable(arr) {
  let inv = 0;
  const a = arr.filter(v => v !== 0);
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      if (a[i] > a[j]) inv++;
  const emptyRow = Math.floor(arr.indexOf(0) / 4); // de cima
  const rowFromBottom = 4 - emptyRow;
  // 4x4: resolvível se (inv par e linha-de-baixo ímpar) ou (inv ímpar e linha-de-baixo par)
  return (rowFromBottom % 2 === 0) ? (inv % 2 === 1) : (inv % 2 === 0);
}

function deslizaClick(i) {
  const empty = deslizaTiles.indexOf(0);
  const r = Math.floor(i / 4), c = i % 4;
  const er = Math.floor(empty / 4), ec = empty % 4;
  if ((Math.abs(r - er) === 1 && c === ec) || (Math.abs(c - ec) === 1 && r === er)) {
    [deslizaTiles[empty], deslizaTiles[i]] = [deslizaTiles[i], deslizaTiles[empty]];
    deslizaMoves++;
    playBeep(500);
    deslizaRender();
    if (deslizaWon()) deslizaWin();
  }
}

function deslizaArrow(dir) {
  // move a peça adjacente ao vazio na direção indicada
  const empty = deslizaTiles.indexOf(0);
  const er = Math.floor(empty / 4), ec = empty % 4;
  let tr = er, tc = ec;
  if (dir === "up")    tr = er + 1;
  if (dir === "down")  tr = er - 1;
  if (dir === "left")  tc = ec + 1;
  if (dir === "right") tc = ec - 1;
  if (tr < 0 || tr > 3 || tc < 0 || tc > 3) return;
  deslizaClick(tr * 4 + tc);
}

function deslizaWon() {
  for (let i = 0; i < 15; i++) if (deslizaTiles[i] !== i + 1) return false;
  return deslizaTiles[15] === 0;
}

function deslizaWin() {
  const ov = gel("desliza-overlay"), msg = gel("desliza-overlay-msg");
  if (ov) ov.classList.remove("hidden");
  if (msg) msg.textContent = `🎉 Resolvido em ${deslizaMoves} jogadas!`;
  playBeep(880);
}

function deslizaRender() {
  const grid = gel("desliza-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const mv = gel("desliza-moves");
  if (mv) mv.textContent = deslizaMoves;
  deslizaTiles.forEach((v, i) => {
    const div = document.createElement("div");
    div.className = "desliza-cell" + (v === 0 ? " empty" : "");
    div.textContent = v === 0 ? "" : v;
    if (v !== 0) div.onclick = () => deslizaClick(i);
    grid.appendChild(div);
  });
}

// ── WORDLE ───────────────────────────────────────────────────────────────────
const WORDLE_WORDS = [
  "TERRA","PRATO","LIVRO","VERDE","PONTE","CARRO","FESTA","MUNDO","PLANO","FORTE",
  "NOITE","TINTA","BARCO","CAMPO","DENTE","GRADE","JOGAR","LEITE","MORTE","NUVEM",
  "PEDRA","RATOS","SALTO","TIGRE","VOLTA","ZEBRA","BANCO","CHUVA","FRUTA","HORAS",
  "LARGO","METRO","NOBRE","OLHOS","PAPEL","RISCO","SONHO","TURMA","VIDRO","FOLHA",
  "GANSO","MEDOS","PEIXE","QUEDA","RAMOS","SUCO","TROCA","VENTO","NAVIO","DOCES",
];
let wordleTarget = "";
let wordleRow = 0;
let wordleDone = false;

function wordleStart() {
  wordleTarget = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
  wordleRow = 0;
  wordleDone = false;
  const inp = gel("wordle-input");
  if (inp) { inp.value = ""; inp.disabled = false; }
  const msg = gel("wordle-msg");
  if (msg) msg.textContent = "";
  wordleRenderBoard();
}

function wordleRenderBoard(rows) {
  const board = gel("wordle-board");
  if (!board) return;
  board.innerHTML = "";
  for (let r = 0; r < 6; r++) {
    const row = document.createElement("div");
    row.className = "wordle-row";
    for (let c = 0; c < 5; c++) {
      const tile = document.createElement("div");
      tile.className = "wordle-tile";
      if (rows && rows[r]) {
        tile.textContent = rows[r].letters[c];
        tile.classList.add(rows[r].states[c]);
      }
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

let wordleGuesses = [];

function wordleKey(e) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  if (wordleDone) return;
  const inp = gel("wordle-input");
  const guess = (inp.value || "").toUpperCase().replace(/[^A-Z]/g, "");
  const msg = gel("wordle-msg");
  if (guess.length !== 5) {
    if (msg) msg.textContent = "Digite uma palavra de 5 letras!";
    return;
  }
  // avalia
  const states = wordleEvaluate(guess, wordleTarget);
  wordleGuesses[wordleRow] = { letters: guess.split(""), states };
  wordleRenderBoard(wordleGuesses);
  inp.value = "";
  wordleRow++;

  if (guess === wordleTarget) {
    wordleDone = true;
    if (msg) msg.textContent = "🎉 Acertou!";
    inp.disabled = true;
    playBeep(880);
  } else if (wordleRow >= 6) {
    wordleDone = true;
    if (msg) msg.textContent = `😢 A palavra era ${wordleTarget}`;
    inp.disabled = true;
    playBeep(200);
  } else {
    playBeep(520);
  }
}

function wordleEvaluate(guess, target) {
  const states = Array(5).fill("absent");
  const t = target.split("");
  // primeira passada: letras corretas
  for (let i = 0; i < 5; i++) {
    if (guess[i] === t[i]) { states[i] = "correct"; t[i] = null; }
  }
  // segunda passada: letras presentes em outra posição
  for (let i = 0; i < 5; i++) {
    if (states[i] === "correct") continue;
    const idx = t.indexOf(guess[i]);
    if (idx !== -1) { states[i] = "present"; t[idx] = null; }
  }
  return states;
}

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
