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
  if (name === "jogos")      showGameMenu();
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

// concede XP por desempenho em jogos (servidor aplica teto diário)
async function awardGameXp(amount, label) {
  if (!amount || amount < 1) return;
  try {
    const res = await apiFetch(`${API}/game/reward`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(amount) }),
    });
    if (res.status === 401) { redirectLogin(); return; }
    const d = await res.json();
    if (d.xp_gained > 0) {
      showToast(`🎮 +${d.xp_gained} XP — ${label}!`, "gold");
      loadStatus();
    } else if (d.daily_remaining === 0) {
      showToast("🎮 Limite diário de XP de jogos atingido. Volte amanhã!", "");
    }
  } catch (e) {}
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

const GAME_LIST = ["snake","2048","memoria","minado","velha","desliza","wordle","quiz",
  "forca","relampago","associacao","anagrama","vf","simon","tetris","lig4","breakout","plataforma"];

// embaralha um array no lugar (Fisher-Yates)
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// núcleo: ativa um jogo numa localização (seção: "" ou modal: "-modal")
function activateGame(name, suffix) {
  currentGame = name;
  const tabsId = suffix === "-modal" ? "game-tabs-modal" : "game-tabs";
  document.querySelectorAll("#" + tabsId + " .game-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.game === name));
  GAME_LIST.forEach(g => {
    const pane = document.getElementById("game-pane-" + g + suffix);
    if (pane) pane.classList.toggle("active", g === name);
  });
  stopAllGames();
  startCurrentGame();
}

// clique numa aba (seção ou modal)
function selectGame(name, btn) {
  activateGame(name, btn.closest(".break-modal") ? "-modal" : "");
}

// clique num card da tela de seleção → abre a área do jogo
function openGameFromMenu(name) {
  document.getElementById("game-menu").classList.add("hidden");
  document.getElementById("game-area").classList.remove("hidden");
  activateGame(name, "");
}

// volta para a tela de seleção de jogos
function backToMenu() {
  stopAllGames();
  document.getElementById("game-area").classList.add("hidden");
  document.getElementById("game-menu").classList.remove("hidden");
}

// exibe a tela de seleção (ao entrar na seção Jogos)
function showGameMenu() {
  stopAllGames();
  document.getElementById("game-area").classList.add("hidden");
  document.getElementById("game-menu").classList.remove("hidden");
}

function stopAllGames() {
  snakeStop();
  relampStop();
  simonStop();
  tetrisStop();
  breakoutStop();
  platStop();
}

function startCurrentGame() {
  if (currentGame === "snake")        snakeReset();
  else if (currentGame === "2048")    g2048Start();
  else if (currentGame === "memoria") memStart();
  else if (currentGame === "minado")  mineStart();
  else if (currentGame === "velha")   velhaStart();
  else if (currentGame === "desliza") deslizaStart();
  else if (currentGame === "wordle")  wordleStart();
  else if (currentGame === "quiz")    quizReset();
  else if (currentGame === "forca")      forcaStart();
  else if (currentGame === "relampago")  relampReset();
  else if (currentGame === "associacao") assocStart();
  else if (currentGame === "anagrama")   anagStart();
  else if (currentGame === "vf")         vfStart();
  else if (currentGame === "simon")      simonReset();
  else if (currentGame === "tetris")     tetrisReset();
  else if (currentGame === "lig4")       lig4Start();
  else if (currentGame === "breakout")   breakoutReset();
  else if (currentGame === "plataforma") platReset();
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
  ["snake","2048","memoria","minado","velha","desliza","wordle","quiz"].forEach(g => {
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
  awardGameXp(Math.floor(snakeScore / 10), "Snake"); // 1 XP por fruta
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
  else if (currentGame === "tetris") {
    e.preventDefault();
    if (dir === "left") tetrisMove(-1);
    else if (dir === "right") tetrisMove(1);
    else if (dir === "up") tetrisRotate();
    else if (dir === "down") tetrisDrop();
  }
  else if (currentGame === "breakout") {
    if (dir === "left") { e.preventDefault(); breakoutMove(-1); }
    else if (dir === "right") { e.preventDefault(); breakoutMove(1); }
  }
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
  awardGameXp(Math.floor(g2048Score / 100), "2048"); // 1 XP por 100 pontos
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
  awardGameXp(Math.max(5, 25 - memMoves), "Memória"); // quanto menos jogadas, mais XP
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
  awardGameXp(25, "Campo Minado");
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
    if (win.who === "❌") awardGameXp(20, "Velha"); // venceu a IA imbatível
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
  awardGameXp(20, "Deslizante");
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
    awardGameXp(30 - (wordleRow - 1) * 4, "Wordle"); // menos tentativas = mais XP
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

// ── QUIZ DAS MATÉRIAS ────────────────────────────────────────────────────────
const QUIZ_BANK = [
  // ── Matemática ──
  { s:"Matemática", q:"Quanto é 7 × 8?", o:["54","56","64","48"], a:1 },
  { s:"Matemática", q:"Qual é a raiz quadrada de 144?", o:["12","14","16","11"], a:0 },
  { s:"Matemática", q:"Quanto é 15% de 200?", o:["20","30","15","45"], a:1 },
  { s:"Matemática", q:"Um triângulo tem quantos lados?", o:["4","3","5","6"], a:1 },
  { s:"Matemática", q:"Quanto é 3⁴ (3 elevado a 4)?", o:["12","64","81","27"], a:2 },
  { s:"Matemática", q:"Qual fração equivale a 0,5?", o:["1/2","1/4","1/3","2/3"], a:0 },
  { s:"Matemática", q:"Quanto é 144 ÷ 12?", o:["10","11","12","13"], a:2 },
  // ── Português ──
  { s:"Português", q:"Qual é o plural de 'cidadão'?", o:["cidadões","cidadãos","cidadães","cidadons"], a:1 },
  { s:"Português", q:"'Casa' é uma palavra do tipo:", o:["verbo","substantivo","adjetivo","advérbio"], a:1 },
  { s:"Português", q:"Qual palavra está escrita corretamente?", o:["excessão","exceção","esceção","excesão"], a:1 },
  { s:"Português", q:"O antônimo de 'alegre' é:", o:["feliz","contente","triste","animado"], a:2 },
  { s:"Português", q:"Quantas sílabas tem a palavra 'abacaxi'?", o:["3","4","5","2"], a:1 },
  { s:"Português", q:"'Rapidamente' é um:", o:["substantivo","advérbio","adjetivo","pronome"], a:1 },
  // ── História ──
  { s:"História", q:"Em que ano o Brasil foi 'descoberto'?", o:["1500","1492","1822","1888"], a:0 },
  { s:"História", q:"Quem proclamou a Independência do Brasil?", o:["Tiradentes","Dom Pedro I","Getúlio Vargas","Dom João VI"], a:1 },
  { s:"História", q:"A Lei Áurea (1888) tratava da:", o:["independência","abolição da escravidão","proclamação da república","constituição"], a:1 },
  { s:"História", q:"Quem foi o primeiro presidente do Brasil?", o:["Deodoro da Fonseca","Getúlio Vargas","Floriano Peixoto","Prudente de Morais"], a:0 },
  { s:"História", q:"A Revolução Francesa começou em:", o:["1789","1822","1500","1914"], a:0 },
  { s:"História", q:"A Segunda Guerra Mundial terminou em:", o:["1918","1945","1939","1950"], a:1 },
  // ── Geografia ──
  { s:"Geografia", q:"Qual é a capital do Brasil?", o:["Rio de Janeiro","São Paulo","Brasília","Salvador"], a:2 },
  { s:"Geografia", q:"Qual é o maior rio do Brasil?", o:["São Francisco","Amazonas","Paraná","Tietê"], a:1 },
  { s:"Geografia", q:"Quantos estados tem o Brasil?", o:["26","27","25","24"], a:0 },
  { s:"Geografia", q:"Qual é o maior continente do mundo?", o:["África","Ásia","Europa","América"], a:1 },
  { s:"Geografia", q:"A Linha do Equador divide a Terra em:", o:["leste e oeste","norte e sul","dois polos","quatro partes"], a:1 },
  { s:"Geografia", q:"Qual oceano banha o litoral brasileiro?", o:["Pacífico","Índico","Atlântico","Ártico"], a:2 },
  // ── Ciências ──
  { s:"Ciências", q:"Qual é o planeta mais próximo do Sol?", o:["Vênus","Mercúrio","Marte","Terra"], a:1 },
  { s:"Ciências", q:"Qual gás as plantas absorvem na fotossíntese?", o:["oxigênio","gás carbônico","nitrogênio","hidrogênio"], a:1 },
  { s:"Ciências", q:"Quantos ossos tem o corpo humano adulto?", o:["206","300","150","250"], a:0 },
  { s:"Ciências", q:"A água é formada por hidrogênio e:", o:["carbono","oxigênio","nitrogênio","enxofre"], a:1 },
  { s:"Ciências", q:"Qual é o maior órgão do corpo humano?", o:["fígado","coração","pele","pulmão"], a:2 },
  { s:"Ciências", q:"Qual animal é um mamífero?", o:["tubarão","golfinho","tartaruga","sapo"], a:1 },
];

const QUIZ_LEN = 10;
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizLocked = false;

function quizReset() {
  // volta para a tela de seleção de matéria
  gel("quiz-setup").classList.remove("hidden");
  gel("quiz-game").classList.add("hidden");
  gel("quiz-result").classList.add("hidden");
}

function quizStart() {
  const subject = gel("quiz-subject").value;
  let pool = subject === "todas"
    ? [...QUIZ_BANK]
    : QUIZ_BANK.filter(q => q.s === subject);
  // embaralha
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  quizQuestions = pool.slice(0, Math.min(QUIZ_LEN, pool.length));
  quizIndex = 0;
  quizScore = 0;
  quizLocked = false;
  gel("quiz-setup").classList.add("hidden");
  gel("quiz-result").classList.add("hidden");
  gel("quiz-game").classList.remove("hidden");
  quizRenderQuestion();
}

function quizRenderQuestion() {
  const item = quizQuestions[quizIndex];
  quizLocked = false;
  gel("quiz-progress").textContent = `${quizIndex + 1} / ${quizQuestions.length}`;
  gel("quiz-score").textContent = `${quizScore} acertos`;
  gel("quiz-question").textContent = item.q;

  // embaralha as opções mantendo o índice da correta
  const opts = item.o.map((text, i) => ({ text, correct: i === item.a }));
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }

  const box = gel("quiz-options");
  box.innerHTML = "";
  opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt.text;
    btn.onclick = () => quizAnswer(btn, opt.correct);
    box.appendChild(btn);
  });
}

function quizAnswer(btn, correct) {
  if (quizLocked) return;
  quizLocked = true;
  const box = gel("quiz-options");
  const buttons = box.querySelectorAll(".quiz-option");

  buttons.forEach(b => b.classList.add("disabled"));

  if (correct) {
    btn.classList.add("correct");
    quizScore++;
    playBeep(660);
  } else {
    btn.classList.add("wrong");
    // destaca a correta
    buttons.forEach(b => {
      const item = quizQuestions[quizIndex];
      if (b.textContent === item.o[item.a]) b.classList.add("correct");
    });
    playBeep(200);
  }
  gel("quiz-score").textContent = `${quizScore} acertos`;

  setTimeout(() => {
    quizIndex++;
    if (quizIndex < quizQuestions.length) quizRenderQuestion();
    else quizEnd();
  }, 1100);
}

function quizEnd() {
  gel("quiz-game").classList.add("hidden");
  gel("quiz-result").classList.remove("hidden");
  const total = quizQuestions.length;
  const pct = total ? quizScore / total : 0;
  let icon, msg;
  if (pct === 1)        { icon = "🏆"; msg = "Perfeito! Você acertou tudo!"; }
  else if (pct >= 0.7)  { icon = "🎉"; msg = "Muito bem! Você mandou bem!"; }
  else if (pct >= 0.5)  { icon = "👍"; msg = "Bom trabalho! Dá pra melhorar."; }
  else                  { icon = "📖"; msg = "Continue estudando, você consegue!"; }
  gel("quiz-result-icon").textContent = icon;
  gel("quiz-result-msg").textContent = `${msg}\nVocê acertou ${quizScore} de ${total} perguntas.`;
  playBeep(pct >= 0.5 ? 880 : 330);
  awardGameXp(quizScore * 5, "Quiz"); // 5 XP por acerto (10/10 = 50 XP)
}

// ── FORCA ────────────────────────────────────────────────────────────────────
const FORCA_FACES = ["😀", "🙂", "😐", "😟", "😣", "😨", "💀"];
let forcaWord = "", forcaGuessed = new Set(), forcaErrors = 0, forcaDone = false;

function forcaStart() {
  forcaWord = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
  forcaGuessed = new Set();
  forcaErrors = 0;
  forcaDone = false;
  const ov = gel("forca-overlay"); if (ov) ov.classList.add("hidden");
  forcaRender();
}

function forcaRender() {
  gel("forca-hangman").textContent = FORCA_FACES[forcaErrors];
  gel("forca-errors").textContent = `Erros: ${forcaErrors} / 6`;
  gel("forca-word").textContent = forcaWord.split("").map(c => forcaGuessed.has(c) ? c : "_").join(" ");
  const box = gel("forca-letters");
  box.innerHTML = "";
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(L => {
    const b = document.createElement("button");
    b.className = "forca-key";
    b.textContent = L;
    b.disabled = forcaGuessed.has(L) || forcaDone;
    b.onclick = () => forcaGuess(L);
    box.appendChild(b);
  });
}

function forcaGuess(L) {
  if (forcaDone || forcaGuessed.has(L)) return;
  forcaGuessed.add(L);
  if (!forcaWord.includes(L)) { forcaErrors++; playBeep(200); }
  else playBeep(620);
  forcaRender();
  if (forcaWord.split("").every(c => forcaGuessed.has(c))) forcaEnd(true);
  else if (forcaErrors >= 6) forcaEnd(false);
}

function forcaEnd(won) {
  forcaDone = true;
  const ov = gel("forca-overlay"), m = gel("forca-overlay-msg");
  if (ov) ov.classList.remove("hidden");
  if (m) m.textContent = won ? `🎉 Acertou: ${forcaWord}` : `💀 A palavra era: ${forcaWord}`;
  playBeep(won ? 880 : 200);
  if (won) awardGameXp(15, "Forca");
}

// ── DESAFIO RELÂMPAGO ────────────────────────────────────────────────────────
let relampScore = 0, relampTime = 60, relampTimer = null, relampAns = 0;

function relampReset() {
  relampStop();
  gel("relamp-setup").classList.remove("hidden");
  gel("relamp-game").classList.add("hidden");
  gel("relamp-result").classList.add("hidden");
}
function relampStop() { if (relampTimer) { clearInterval(relampTimer); relampTimer = null; } }

function relampStart() {
  relampScore = 0;
  relampTime = 60;
  gel("relamp-setup").classList.add("hidden");
  gel("relamp-result").classList.add("hidden");
  gel("relamp-game").classList.remove("hidden");
  gel("relamp-score").textContent = "0";
  gel("relamp-time").textContent = "60";
  relampNext();
  gel("relamp-input").focus();
  relampTimer = setInterval(() => {
    relampTime--;
    const t = gel("relamp-time"); if (t) t.textContent = relampTime;
    if (relampTime <= 0) relampEnd();
  }, 1000);
}

function relampNext() {
  const ops = ["+", "-", "×"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b;
  if (op === "×") { a = 2 + Math.floor(Math.random() * 9); b = 2 + Math.floor(Math.random() * 9); relampAns = a * b; }
  else if (op === "+") { a = 2 + Math.floor(Math.random() * 49); b = 2 + Math.floor(Math.random() * 49); relampAns = a + b; }
  else { a = 10 + Math.floor(Math.random() * 40); b = 1 + Math.floor(Math.random() * a); relampAns = a - b; }
  gel("relamp-problem").textContent = `${a} ${op} ${b}`;
  gel("relamp-input").value = "";
}

function relampKey(e) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const v = parseInt(gel("relamp-input").value, 10);
  if (v === relampAns) { relampScore++; gel("relamp-score").textContent = relampScore; playBeep(660); }
  else playBeep(200);
  relampNext();
}

function relampEnd() {
  relampStop();
  gel("relamp-game").classList.add("hidden");
  gel("relamp-result").classList.remove("hidden");
  gel("relamp-result-msg").textContent = `Você acertou ${relampScore} contas em 60 segundos!`;
  playBeep(880);
  awardGameXp(relampScore * 2, "Relâmpago");
}

// ── ASSOCIAÇÃO ───────────────────────────────────────────────────────────────
const ASSOC_BANK = [
  [["Brasil","Brasília"],["França","Paris"],["Japão","Tóquio"],["Itália","Roma"],["Egito","Cairo"]],
  [["H₂O","Água"],["O₂","Oxigênio"],["CO₂","Gás carbônico"],["NaCl","Sal"],["CH₄","Metano"]],
  [["2 × 6","12"],["15 + 9","24"],["100 ÷ 4","25"],["8 × 8","64"],["50 − 17","33"]],
  [["Coração","Bombear sangue"],["Pulmão","Respiração"],["Estômago","Digestão"],["Cérebro","Pensar"],["Rim","Filtrar"]],
];
let assocPairs = [], assocSelLeft = null, assocMatched = 0;

function assocStart() {
  assocPairs = ASSOC_BANK[Math.floor(Math.random() * ASSOC_BANK.length)];
  assocSelLeft = null;
  assocMatched = 0;
  const lefts = shuffle(assocPairs.map((p, i) => ({ t: p[0], i })));
  const rights = shuffle(assocPairs.map((p, i) => ({ t: p[1], i })));
  assocRenderCol("assoc-left", lefts, "L");
  assocRenderCol("assoc-right", rights, "R");
  gel("assoc-msg").textContent = "";
}

function assocRenderCol(baseId, items, side) {
  const col = gel(baseId);
  col.innerHTML = "";
  items.forEach(it => {
    const d = document.createElement("div");
    d.className = "assoc-item";
    d.textContent = it.t;
    d.dataset.i = it.i;
    d.onclick = () => side === "L" ? assocPickLeft(it.i, d) : assocPickRight(it.i, d);
    col.appendChild(d);
  });
}

function assocPickLeft(i, el) {
  if (el.classList.contains("matched")) return;
  gel("assoc-left").querySelectorAll(".assoc-item").forEach(x => x.classList.remove("selected"));
  el.classList.add("selected");
  assocSelLeft = i;
}

function assocPickRight(i, el) {
  if (assocSelLeft === null || el.classList.contains("matched")) return;
  if (i === assocSelLeft) {
    el.classList.add("matched");
    gel("assoc-left").querySelectorAll(".assoc-item").forEach(x => {
      if (parseInt(x.dataset.i, 10) === i) { x.classList.add("matched"); x.classList.remove("selected"); }
    });
    assocSelLeft = null;
    assocMatched++;
    playBeep(660);
    gel("assoc-msg").textContent = "";
    if (assocMatched === assocPairs.length) {
      gel("assoc-msg").textContent = "🎉 Você ligou todos os pares!";
      playBeep(880);
      awardGameXp(15, "Associação");
    }
  } else {
    gel("assoc-msg").textContent = "❌ Não é esse par, tente de novo.";
    playBeep(200);
    gel("assoc-left").querySelectorAll(".assoc-item").forEach(x => x.classList.remove("selected"));
    assocSelLeft = null;
  }
}

// ── ANAGRAMA ─────────────────────────────────────────────────────────────────
let anagWord = "", anagScore = 0;

function anagStart() {
  anagScore = 0;
  gel("anag-score").textContent = "0";
  anagNext();
}

function anagNext() {
  anagWord = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
  let scrambled;
  do { scrambled = shuffle(anagWord.split("")).join(""); } while (scrambled === anagWord);
  const box = gel("anag-letters");
  box.innerHTML = "";
  scrambled.split("").forEach(L => {
    const t = document.createElement("div");
    t.className = "anag-tile";
    t.textContent = L;
    box.appendChild(t);
  });
  gel("anag-input").value = "";
  gel("anag-msg").textContent = "";
}

function anagKey(e) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const v = (gel("anag-input").value || "").toUpperCase().trim();
  if (v === anagWord) {
    anagScore++;
    gel("anag-score").textContent = anagScore;
    gel("anag-msg").textContent = "🎉 Acertou!";
    playBeep(660);
    awardGameXp(5, "Anagrama");
    setTimeout(anagNext, 800);
  } else {
    gel("anag-msg").textContent = "❌ Tente de novo.";
    playBeep(200);
  }
}

function anagSkip() {
  gel("anag-msg").textContent = `A palavra era: ${anagWord}`;
  setTimeout(anagNext, 900);
}

// ── VERDADEIRO OU FALSO ──────────────────────────────────────────────────────
const VF_BANK = [
  ["A Terra é o terceiro planeta a partir do Sol.", true],
  ["O Sol gira em torno da Terra.", false],
  ["A água ferve a 100°C ao nível do mar.", true],
  ["Os morcegos são aves.", false],
  ["O Brasil é o maior país da América do Sul.", true],
  ["O coração bombeia sangue pelo corpo.", true],
  ["As aranhas são insetos.", false],
  ["A Lua tem luz própria.", false],
  ["O oxigênio é essencial para a respiração humana.", true],
  ["Os dinossauros conviveram com os primeiros humanos.", false],
  ["1 quilômetro equivale a 100 metros.", false],
  ["As plantas produzem oxigênio na fotossíntese.", true],
  ["O gelo é a água no estado sólido.", true],
  ["A baleia é um peixe.", false],
  ["O Brasil foi colonizado por Portugal.", true],
  ["Um triângulo tem quatro lados.", false],
];
let vfQ = [], vfIdx = 0, vfScore = 0;

function vfStart() {
  vfQ = shuffle(VF_BANK.slice()).slice(0, 10);
  vfIdx = 0;
  vfScore = 0;
  gel("vf-game").classList.remove("hidden");
  gel("vf-result").classList.add("hidden");
  vfRender();
}

function vfRender() {
  gel("vf-progress").textContent = `${vfIdx + 1} / ${vfQ.length}`;
  gel("vf-score").textContent = `${vfScore} acertos`;
  gel("vf-statement").textContent = vfQ[vfIdx][0];
  gel("vf-msg").textContent = "";
}

function vfAnswer(ans) {
  if (vfIdx >= vfQ.length) return;
  const correct = vfQ[vfIdx][1] === ans;
  if (correct) { vfScore++; gel("vf-msg").textContent = "✅ Certo!"; playBeep(660); }
  else { gel("vf-msg").textContent = "❌ Errado!"; playBeep(200); }
  gel("vf-score").textContent = `${vfScore} acertos`;
  vfIdx++;
  setTimeout(() => { if (vfIdx < vfQ.length) vfRender(); else vfEnd(); }, 750);
}

function vfEnd() {
  gel("vf-game").classList.add("hidden");
  gel("vf-result").classList.remove("hidden");
  gel("vf-result-icon").textContent = vfScore >= 7 ? "🎉" : vfScore >= 5 ? "👍" : "📖";
  gel("vf-result-msg").textContent = `Você acertou ${vfScore} de ${vfQ.length}!`;
  playBeep(vfScore >= 5 ? 880 : 330);
  awardGameXp(vfScore * 3, "V ou F");
}

// ── SIMON ────────────────────────────────────────────────────────────────────
const SIMON_TONES = [330, 440, 550, 660];
let simonSeq = [], simonInput = 0, simonLevel = 0, simonPlaying = false, simonTimeouts = [];

function simonReset() {
  simonStop();
  simonSeq = [];
  simonLevel = 0;
  const lv = gel("simon-level"); if (lv) lv.textContent = "0";
  const msg = gel("simon-msg"); if (msg) msg.textContent = "Clique em Começar";
}
function simonStop() {
  simonPlaying = false;
  simonTimeouts.forEach(clearTimeout);
  simonTimeouts = [];
}

function simonStart() {
  simonReset();
  simonNext();
}

function simonNext() {
  simonInput = 0;
  simonLevel++;
  gel("simon-level").textContent = simonLevel;
  simonSeq.push(Math.floor(Math.random() * 4));
  gel("simon-msg").textContent = "Observe a sequência...";
  simonPlaying = true;
  simonSeq.forEach((c, i) => {
    simonTimeouts.push(setTimeout(() => simonFlash(c), 650 * (i + 1)));
  });
  simonTimeouts.push(setTimeout(() => {
    simonPlaying = false;
    const msg = gel("simon-msg"); if (msg) msg.textContent = "Sua vez!";
  }, 650 * (simonSeq.length + 1)));
}

function simonFlash(c) {
  const btn = gel("simon-" + c);
  if (!btn) return;
  btn.classList.add("lit");
  playBeep(SIMON_TONES[c]);
  setTimeout(() => btn.classList.remove("lit"), 350);
}

function simonClick(c) {
  if (simonPlaying || simonSeq.length === 0) return;
  simonFlash(c);
  if (c === simonSeq[simonInput]) {
    simonInput++;
    if (simonInput === simonSeq.length) {
      gel("simon-msg").textContent = "✅ Boa! Próximo nível...";
      setTimeout(simonNext, 850);
    }
  } else {
    gel("simon-msg").textContent = `💀 Errou! Você chegou ao nível ${simonLevel}`;
    playBeep(180);
    simonStop();
    awardGameXp(simonLevel * 2, "Simon");
    simonSeq = [];
  }
}

// ── TETRIS ───────────────────────────────────────────────────────────────────
const TET_COLS = 10, TET_ROWS = 20;
const TET_SHAPES = [
  [[1,1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]],
];
const TET_COLORS = ["#22d3ee","#fbbf24","#c084fc","#3b82f6","#fb923c","#22c55e","#ef4444"];
let tetGrid = [], tetPiece = null, tetPX = 0, tetPY = 0, tetColor = 0;
let tetLoop = null, tetScore = 0, tetLines = 0, tetRunning = false;

function tetrisReset() {
  tetrisStop();
  tetGrid = Array.from({ length: TET_ROWS }, () => Array(TET_COLS).fill(0));
  tetPiece = null;
  tetScore = 0; tetLines = 0;
  const ov = gel("tetris-overlay");
  if (ov) { ov.classList.remove("hidden"); gel("tetris-overlay-msg").textContent = "Pronto?"; }
  tetUpdateStats();
  tetDraw();
}
function tetrisStop() { tetRunning = false; if (tetLoop) { clearInterval(tetLoop); tetLoop = null; } }

function tetrisStart() {
  tetGrid = Array.from({ length: TET_ROWS }, () => Array(TET_COLS).fill(0));
  tetScore = 0; tetLines = 0;
  tetUpdateStats();
  const ov = gel("tetris-overlay"); if (ov) ov.classList.add("hidden");
  tetSpawn();
  tetRunning = true;
  tetLoop = setInterval(tetTick, 500);
}

function tetSpawn() {
  const idx = Math.floor(Math.random() * TET_SHAPES.length);
  tetPiece = TET_SHAPES[idx].map(r => r.slice());
  tetColor = idx;
  tetPX = Math.floor((TET_COLS - tetPiece[0].length) / 2);
  tetPY = 0;
  if (tetCollide(tetPX, tetPY, tetPiece)) tetrisOver();
}

function tetCollide(px, py, piece) {
  for (let r = 0; r < piece.length; r++)
    for (let c = 0; c < piece[r].length; c++) {
      if (!piece[r][c]) continue;
      const x = px + c, y = py + r;
      if (x < 0 || x >= TET_COLS || y >= TET_ROWS) return true;
      if (y >= 0 && tetGrid[y][x]) return true;
    }
  return false;
}

function tetMerge() {
  tetPiece.forEach((row, r) => row.forEach((v, c) => {
    if (v) { const y = tetPY + r, x = tetPX + c; if (y >= 0) tetGrid[y][x] = tetColor + 1; }
  }));
}

function tetClear() {
  let cleared = 0;
  for (let r = TET_ROWS - 1; r >= 0; r--) {
    if (tetGrid[r].every(v => v)) {
      tetGrid.splice(r, 1);
      tetGrid.unshift(Array(TET_COLS).fill(0));
      cleared++; r++;
    }
  }
  if (cleared) {
    tetLines += cleared;
    tetScore += [0, 40, 100, 300, 1200][cleared];
    tetUpdateStats();
    playBeep(660);
  }
}

function tetTick() {
  if (!tetRunning) return;
  if (!tetCollide(tetPX, tetPY + 1, tetPiece)) tetPY++;
  else { tetMerge(); tetClear(); tetSpawn(); }
  tetDraw();
}

function tetrisMove(dx) {
  if (!tetRunning || !tetPiece) return;
  if (!tetCollide(tetPX + dx, tetPY, tetPiece)) { tetPX += dx; tetDraw(); }
}
function tetrisRotate() {
  if (!tetRunning || !tetPiece) return;
  const rot = tetPiece[0].map((_, i) => tetPiece.map(r => r[i]).reverse());
  if (!tetCollide(tetPX, tetPY, rot)) { tetPiece = rot; tetDraw(); }
}
function tetrisDrop() {
  if (!tetRunning || !tetPiece) return;
  while (!tetCollide(tetPX, tetPY + 1, tetPiece)) tetPY++;
  tetMerge(); tetClear(); tetSpawn(); tetDraw();
}

function tetUpdateStats() {
  const s = gel("tetris-score"), l = gel("tetris-lines");
  if (s) s.textContent = tetScore;
  if (l) l.textContent = tetLines;
}

function tetrisOver() {
  tetrisStop();
  const ov = gel("tetris-overlay");
  if (ov) { ov.classList.remove("hidden"); gel("tetris-overlay-msg").textContent = `💀 Game over! Linhas: ${tetLines}`; }
  playBeep(200);
  awardGameXp(tetLines * 5 + Math.floor(tetScore / 100), "Tetris");
}

function tetDraw() {
  const cv = gel("tetris-canvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const cell = cv.width / TET_COLS;
  const css = getComputedStyle(document.documentElement);
  ctx.fillStyle = css.getPropertyValue("--surface2").trim() || "#16213e";
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < TET_ROWS; r++)
    for (let c = 0; c < TET_COLS; c++)
      if (tetGrid[r][c]) { ctx.fillStyle = TET_COLORS[tetGrid[r][c] - 1]; ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2); }
  if (tetPiece)
    tetPiece.forEach((row, r) => row.forEach((v, c) => {
      if (v) { ctx.fillStyle = TET_COLORS[tetColor]; ctx.fillRect((tetPX + c) * cell + 1, (tetPY + r) * cell + 1, cell - 2, cell - 2); }
    }));
}

// ── LIG 4 (Connect 4) ────────────────────────────────────────────────────────
const L4_COLS = 7, L4_ROWS = 6;
let l4Grid = [], l4Over = false;

function lig4Start() {
  l4Grid = Array.from({ length: L4_ROWS }, () => Array(L4_COLS).fill(0));
  l4Over = false;
  const ov = gel("lig4-overlay"); if (ov) ov.classList.add("hidden");
  lig4Render();
}

function l4DropRow(col) {
  for (let r = L4_ROWS - 1; r >= 0; r--) if (!l4Grid[r][col]) return r;
  return -1;
}
function l4Full() { return l4Grid[0].every(v => v); }

function lig4Drop(col) {
  if (l4Over) return;
  let r = l4DropRow(col);
  if (r < 0) return;
  l4Grid[r][col] = 1;
  lig4Render();
  if (lig4CheckWin(1)) { lig4End("🎉 Você venceu!", true); awardGameXp(20, "Lig 4"); return; }
  if (l4Full()) { lig4End("🤝 Empate!", false); return; }
  // CPU
  const cpuCol = l4BestMove();
  l4Grid[l4DropRow(cpuCol)][cpuCol] = 2;
  lig4Render();
  if (lig4CheckWin(2)) { lig4End("🤖 A CPU venceu!", false); return; }
  if (l4Full()) lig4End("🤝 Empate!", false);
}

function l4BestMove() {
  // 1) tenta vencer  2) bloqueia o jogador  3) aleatório
  for (const p of [2, 1]) {
    for (let c = 0; c < L4_COLS; c++) {
      const r = l4DropRow(c);
      if (r < 0) continue;
      l4Grid[r][c] = p;
      const win = lig4CheckWin(p);
      l4Grid[r][c] = 0;
      if (win) return c;
    }
  }
  const valid = [];
  for (let c = 0; c < L4_COLS; c++) if (l4DropRow(c) >= 0) valid.push(c);
  return valid[Math.floor(Math.random() * valid.length)];
}

function lig4CheckWin(p) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < L4_ROWS; r++)
    for (let c = 0; c < L4_COLS; c++) {
      if (l4Grid[r][c] !== p) continue;
      for (const [dr, dc] of dirs) {
        let k = 1;
        while (k < 4) {
          const nr = r + dr * k, nc = c + dc * k;
          if (nr < 0 || nr >= L4_ROWS || nc < 0 || nc >= L4_COLS || l4Grid[nr][nc] !== p) break;
          k++;
        }
        if (k === 4) return true;
      }
    }
  return false;
}

function lig4End(msg, won) {
  l4Over = true;
  const ov = gel("lig4-overlay"), m = gel("lig4-overlay-msg");
  if (ov) ov.classList.remove("hidden");
  if (m) m.textContent = msg;
  playBeep(won ? 880 : 300);
}

function lig4Render() {
  const b = gel("lig4-board");
  if (!b) return;
  b.innerHTML = "";
  for (let r = 0; r < L4_ROWS; r++)
    for (let c = 0; c < L4_COLS; c++) {
      const d = document.createElement("div");
      d.className = "lig4-cell" + (l4Grid[r][c] === 1 ? " p1" : l4Grid[r][c] === 2 ? " p2" : "");
      d.onclick = () => lig4Drop(c);
      b.appendChild(d);
    }
}

// ── BREAKOUT ─────────────────────────────────────────────────────────────────
const BK_W = 300, BK_H = 300;
let bkBall, bkPaddle, bkBricks = [], bkScore = 0, bkLives = 3, bkLoop = null, bkRunning = false;

function breakoutReset() {
  breakoutStop();
  bkScore = 0; bkLives = 3;
  breakoutSetup();
  const ov = gel("breakout-overlay");
  if (ov) { ov.classList.remove("hidden"); gel("breakout-overlay-msg").textContent = "Pronto?"; }
  bkUpdateStats();
  breakoutDraw();
}
function breakoutStop() { bkRunning = false; if (bkLoop) { cancelAnimationFrame(bkLoop); bkLoop = null; } }

function breakoutSetup() {
  bkPaddle = { x: BK_W / 2 - 30, w: 60, h: 10 };
  bkBall = { x: BK_W / 2, y: BK_H - 30, dx: 2.5, dy: -2.5, r: 6 };
  bkBricks = [];
  const cols = 7, rows = 4, bw = 38, bh = 14, pad = 4, offX = 8, offY = 24;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      bkBricks.push({ x: offX + c * (bw + pad), y: offY + r * (bh + pad), w: bw, h: bh, alive: true, col: r });
}

function breakoutStart() {
  const ov = gel("breakout-overlay"); if (ov) ov.classList.add("hidden");
  if (!bkBricks.length || bkBricks.every(b => !b.alive)) { bkScore = 0; bkLives = 3; breakoutSetup(); bkUpdateStats(); }
  const cv = gel("breakout-canvas");
  if (cv) cv.onmousemove = (e) => {
    const rect = cv.getBoundingClientRect();
    bkPaddle.x = (e.clientX - rect.left) * (BK_W / rect.width) - bkPaddle.w / 2;
    bkClampPaddle();
  };
  bkRunning = true;
  breakoutLoop();
}

function breakoutMove(dir) {
  if (!bkPaddle) return;
  bkPaddle.x += dir * 24;
  bkClampPaddle();
  if (!bkRunning) breakoutDraw();
}
function bkClampPaddle() { bkPaddle.x = Math.max(0, Math.min(BK_W - bkPaddle.w, bkPaddle.x)); }

function breakoutLoop() {
  if (!bkRunning) return;
  bkStep();
  breakoutDraw();
  bkLoop = requestAnimationFrame(breakoutLoop);
}

function bkStep() {
  const ball = bkBall;
  ball.x += ball.dx;
  ball.y += ball.dy;
  if (ball.x < ball.r || ball.x > BK_W - ball.r) ball.dx *= -1;
  if (ball.y < ball.r) ball.dy *= -1;
  // raquete
  if (ball.y > BK_H - 20 - ball.r && ball.y < BK_H - 10 &&
      ball.x > bkPaddle.x && ball.x < bkPaddle.x + bkPaddle.w && ball.dy > 0) {
    ball.dy *= -1;
    ball.dx = ((ball.x - (bkPaddle.x + bkPaddle.w / 2)) / (bkPaddle.w / 2)) * 3.5;
  }
  // caiu embaixo
  if (ball.y > BK_H) {
    bkLives--;
    bkUpdateStats();
    if (bkLives <= 0) { breakoutOver(false); return; }
    ball.x = BK_W / 2; ball.y = BK_H - 30; ball.dx = 2.5; ball.dy = -2.5;
  }
  // blocos
  for (const br of bkBricks) {
    if (!br.alive) continue;
    if (ball.x > br.x && ball.x < br.x + br.w && ball.y > br.y && ball.y < br.y + br.h) {
      br.alive = false;
      ball.dy *= -1;
      bkScore += 10;
      bkUpdateStats();
      playBeep(500 + br.col * 60);
      break;
    }
  }
  if (bkBricks.every(b => !b.alive)) breakoutOver(true);
}

function bkUpdateStats() {
  const s = gel("breakout-score"), l = gel("breakout-lives");
  if (s) s.textContent = bkScore;
  if (l) l.textContent = bkLives;
}

function breakoutOver(won) {
  breakoutStop();
  const ov = gel("breakout-overlay");
  if (ov) { ov.classList.remove("hidden"); gel("breakout-overlay-msg").textContent = won ? `🎉 Venceu! Pontos: ${bkScore}` : `💀 Game over! Pontos: ${bkScore}`; }
  playBeep(won ? 880 : 200);
  awardGameXp(Math.floor(bkScore / 10), "Breakout");
}

function breakoutDraw() {
  const cv = gel("breakout-canvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  ctx.fillStyle = css.getPropertyValue("--surface2").trim() || "#16213e";
  ctx.fillRect(0, 0, BK_W, BK_H);
  const colors = ["#ef4444", "#fb923c", "#fbbf24", "#22c55e"];
  bkBricks.forEach(br => { if (br.alive) { ctx.fillStyle = colors[br.col % colors.length]; ctx.fillRect(br.x, br.y, br.w, br.h); } });
  ctx.fillStyle = css.getPropertyValue("--accent2").trim() || "#a855f7";
  ctx.fillRect(bkPaddle.x, BK_H - 20, bkPaddle.w, bkPaddle.h);
  ctx.beginPath();
  ctx.arc(bkBall.x, bkBall.y, bkBall.r, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
}

// ── PLATAFORMA (estilo Mario) ────────────────────────────────────────────────
const PLAT_W = 360, PLAT_H = 260;
const PLAT_GRAV = 0.55, PLAT_SPEED = 3, PLAT_JUMP = 10.5;
const PLAT_WORLD_W = 1700;

// chão (com buracos) e plataformas flutuantes
const PLAT_PLATFORMS = [
  { x: 0,    y: 230, w: 320, h: 30 },
  { x: 380,  y: 230, w: 240, h: 30 },
  { x: 700,  y: 230, w: 300, h: 30 },
  { x: 1080, y: 230, w: 620, h: 30 },
  { x: 210,  y: 175, w: 80,  h: 14 },
  { x: 340,  y: 140, w: 70,  h: 14 },
  { x: 480,  y: 165, w: 80,  h: 14 },
  { x: 640,  y: 130, w: 70,  h: 14 },
  { x: 840,  y: 160, w: 90,  h: 14 },
  { x: 980,  y: 125, w: 80,  h: 14 },
  { x: 1180, y: 165, w: 90,  h: 14 },
  { x: 1340, y: 135, w: 90,  h: 14 },
];
const PLAT_COINS_INIT = [
  [240,145],[365,110],[505,135],[665,100],[860,130],[1005,95],
  [430,200],[560,200],[760,200],[1210,135],[1370,105],[1120,200],[1250,200],
];
const PLAT_GOAL = { x: 1620, y: 170, w: 20, h: 60 };

let platPlayer, platCoins, platCoinsGot, platLives, platCam, platLoop, platRunning, platOver;
let platState = "play", platAnimTick = 0, platVictoryRAF = null;
const platKeys = { left: false, right: false };

// sprites do personagem (tiras horizontais; ver assets/LEIA-ME.txt)
const HERO_SPRITES = {
  run:     { img: new Image(), frames: 8, loaded: false },
  jump:    { img: new Image(), frames: 6, loaded: false },
  victory: { img: new Image(), frames: 6, loaded: false },
};
HERO_SPRITES.run.img.src     = "assets/corrida.png";
HERO_SPRITES.jump.img.src    = "assets/pulo.png";
HERO_SPRITES.victory.img.src = "assets/vitoria.png";
Object.values(HERO_SPRITES).forEach(s => { s.img.onload = () => { s.loaded = true; }; });

// desenha o herói com sprite animado; retorna false se a imagem ainda não carregou
function platDrawHero(ctx, sx) {
  const p = platPlayer;
  let strip, frameDiv = 5, animate = true;
  if (platState === "victory") { strip = HERO_SPRITES.victory; frameDiv = 6; }
  else if (!p.onGround)        { strip = HERO_SPRITES.jump; }
  else if (p.vx !== 0)         { strip = HERO_SPRITES.run; }
  else                         { strip = HERO_SPRITES.run; animate = false; }

  if (!strip || !strip.loaded || !strip.img.width) return false;

  const fw = strip.img.width / strip.frames;
  const fh = strip.img.height;
  const fi = animate ? Math.floor(platAnimTick / frameDiv) % strip.frames : 0;

  // escala mantendo proporção; pés alinhados à base do hitbox
  const dh = 42, dw = (fw / fh) * dh;
  const dx = sx + p.w / 2 - dw / 2;
  const dy = p.y + p.h - dh;

  ctx.save();
  if (p.face < 0) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(strip.img, fi * fw, 0, fw, fh, 0, 0, dw, dh);
  } else {
    ctx.drawImage(strip.img, fi * fw, 0, fw, fh, dx, dy, dw, dh);
  }
  ctx.restore();
  return true;
}

function platReset() {
  platStop();
  platLives = 3;
  platCoinsGot = 0;
  platState = "play";
  platSpawn();
  platCoins = PLAT_COINS_INIT.map(([x, y]) => ({ x, y, taken: false }));
  const ov = gel("plat-overlay");
  if (ov) { ov.classList.remove("hidden"); gel("plat-overlay-msg").textContent = "Pronto para a aventura?"; }
  platUpdateStats();
  platDraw();
}
function platStop() {
  platRunning = false;
  if (platLoop) { cancelAnimationFrame(platLoop); platLoop = null; }
  if (platVictoryRAF) { cancelAnimationFrame(platVictoryRAF); platVictoryRAF = null; }
}

function platSpawn() {
  platPlayer = { x: 30, y: 190, w: 20, h: 20, vx: 0, vy: 0, onGround: false, face: 1 };
  platCam = 0;
}

function platStart() {
  const ov = gel("plat-overlay"); if (ov) ov.classList.add("hidden");
  if (platOver || platLives <= 0) { platLives = 3; platCoinsGot = 0; platCoins = PLAT_COINS_INIT.map(([x, y]) => ({ x, y, taken: false })); }
  platOver = false;
  platState = "play";
  platSpawn();
  platUpdateStats();
  platRunning = true;
  platLoop = requestAnimationFrame(platTick);
}

function platHold(dir, val) { platKeys[dir] = val; }

function platJump() {
  if (!platRunning || !platPlayer) return;
  if (platPlayer.onGround) { platPlayer.vy = -PLAT_JUMP; platPlayer.onGround = false; playBeep(520); }
}

function rectsHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function platTick() {
  if (!platRunning) return;
  platAnimTick++;
  const p = platPlayer;

  // movimento horizontal
  p.vx = (platKeys.right ? PLAT_SPEED : 0) - (platKeys.left ? PLAT_SPEED : 0);
  if (p.vx !== 0) p.face = p.vx > 0 ? 1 : -1;
  p.x += p.vx;
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > PLAT_WORLD_W) p.x = PLAT_WORLD_W - p.w;
  // colisão horizontal
  for (const pl of PLAT_PLATFORMS) {
    if (rectsHit(p, pl)) {
      if (p.vx > 0) p.x = pl.x - p.w;
      else if (p.vx < 0) p.x = pl.x + pl.w;
    }
  }

  // gravidade / vertical
  p.vy += PLAT_GRAV;
  p.y += p.vy;
  p.onGround = false;
  for (const pl of PLAT_PLATFORMS) {
    if (rectsHit(p, pl)) {
      if (p.vy > 0) { p.y = pl.y - p.h; p.vy = 0; p.onGround = true; }
      else if (p.vy < 0) { p.y = pl.y + pl.h; p.vy = 0; }
    }
  }

  // caiu no buraco
  if (p.y > PLAT_H + 40) {
    platLives--;
    platUpdateStats();
    playBeep(180);
    if (platLives <= 0) { platEnd(false); return; }
    platSpawn();
  }

  // moedas
  for (const c of platCoins) {
    if (!c.taken && rectsHit(p, { x: c.x - 8, y: c.y - 8, w: 16, h: 16 })) {
      c.taken = true;
      platCoinsGot++;
      platUpdateStats();
      playBeep(740);
    }
  }

  // chegou na bandeira
  if (rectsHit(p, PLAT_GOAL)) { platEnd(true); return; }

  // câmera segue o jogador
  platCam = Math.max(0, Math.min(p.x - PLAT_W / 2, PLAT_WORLD_W - PLAT_W));

  platDraw();
  platLoop = requestAnimationFrame(platTick);
}

function platUpdateStats() {
  const c = gel("plat-coins"), l = gel("plat-lives");
  if (c) c.textContent = platCoinsGot;
  if (l) l.textContent = platLives;
}

function platShowOverlay(won) {
  const ov = gel("plat-overlay");
  if (ov) {
    ov.classList.remove("hidden");
    gel("plat-overlay-msg").textContent = won
      ? `🏁 Você chegou! Moedas: ${platCoinsGot}`
      : `💀 Game over! Moedas: ${platCoinsGot}`;
  }
}

function platEnd(won) {
  platRunning = false;
  if (platLoop) { cancelAnimationFrame(platLoop); platLoop = null; }
  platOver = true;
  playBeep(won ? 880 : 200);
  awardGameXp(platCoinsGot * 2 + (won ? 20 : 0), "Plataforma");

  if (won) {
    // toca a animação de vitória antes de mostrar o overlay
    platState = "victory";
    platAnimTick = 0;
    let f = 0;
    const vloop = () => {
      platAnimTick++;
      platDraw();
      f++;
      if (f < 96) platVictoryRAF = requestAnimationFrame(vloop);
      else { platVictoryRAF = null; platShowOverlay(true); }
    };
    vloop();
  } else {
    platShowOverlay(false);
  }
}

function platDraw() {
  const cv = gel("plat-canvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const cam = platCam;
  ctx.clearRect(0, 0, PLAT_W, PLAT_H);

  // nuvens decorativas (parallax leve)
  ctx.fillStyle = "rgba(255,255,255,.12)";
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 400 - cam * 0.4) % (PLAT_W + 120)) - 60;
    ctx.beginPath();
    ctx.arc(cx, 40 + (i % 2) * 25, 18, 0, Math.PI * 2);
    ctx.arc(cx + 20, 40 + (i % 2) * 25, 22, 0, Math.PI * 2);
    ctx.arc(cx + 42, 40 + (i % 2) * 25, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // plataformas
  PLAT_PLATFORMS.forEach(pl => {
    const sx = pl.x - cam;
    if (sx + pl.w < 0 || sx > PLAT_W) return;
    const isGround = pl.h > 20;
    ctx.fillStyle = isGround ? "#3d8b40" : "#a0703c";
    ctx.fillRect(sx, pl.y, pl.w, pl.h);
    ctx.fillStyle = isGround ? "#4caf50" : "#c08850";
    ctx.fillRect(sx, pl.y, pl.w, 5);
  });

  // moedas
  platCoins.forEach(c => {
    if (c.taken) return;
    const sx = c.x - cam;
    if (sx < -10 || sx > PLAT_W + 10) return;
    ctx.beginPath();
    ctx.arc(sx, c.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // bandeira (goal)
  const gx = PLAT_GOAL.x - cam;
  if (gx < PLAT_W + 20) {
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(gx, PLAT_GOAL.y, 3, PLAT_GOAL.h);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(gx + 3, PLAT_GOAL.y);
    ctx.lineTo(gx + 22, PLAT_GOAL.y + 8);
    ctx.lineTo(gx + 3, PLAT_GOAL.y + 16);
    ctx.fill();
  }

  // jogador — sprite animado, com fallback para o quadrado vermelho
  const px = platPlayer.x - cam;
  if (!platDrawHero(ctx, px)) {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(px, platPlayer.y, platPlayer.w, platPlayer.h);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(px + 3, platPlayer.y + 4, platPlayer.w - 6, 7);
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(px + (platPlayer.face > 0 ? platPlayer.w - 7 : 3), platPlayer.y + 5, 3, 3);
  }
}

// teclado da plataforma (movimento contínuo + pulo)
document.addEventListener("keydown", (e) => {
  if (currentGame !== "plataforma") return;
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { platKeys.left = true; e.preventDefault(); }
  else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { platKeys.right = true; e.preventDefault(); }
  else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") { platJump(); e.preventDefault(); }
});
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") platKeys.left = false;
  else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") platKeys.right = false;
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
