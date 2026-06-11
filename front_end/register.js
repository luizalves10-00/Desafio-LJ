const API = "http://localhost:5000/api";

const form         = document.getElementById("register-form");
const btnSubmit    = document.getElementById("btn-submit");
const errBox       = document.getElementById("alert-error");
const okBox        = document.getElementById("alert-success");
const strengthFill = document.getElementById("strength-fill");
const strengthLbl  = document.getElementById("strength-label");
const confirmHint  = document.getElementById("confirm-hint");
const pwdInput     = document.getElementById("password");
const cfmInput     = document.getElementById("confirm");

const LEVELS = [
  { min: 0,  color: "#ef4444", label: "Muito fraca", pct: 15  },
  { min: 1,  color: "#f97316", label: "Fraca",       pct: 30  },
  { min: 2,  color: "#f59e0b", label: "Razoável",    pct: 55  },
  { min: 3,  color: "#84cc16", label: "Boa",         pct: 80  },
  { min: 4,  color: "#10b981", label: "Forte",       pct: 100 },
];

function scorePassword(pwd) {
  let score = 0;
  if (pwd.length >= 6)  score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

pwdInput.addEventListener("input", () => {
  const pwd = pwdInput.value;
  if (!pwd) {
    strengthFill.style.width = "0%";
    strengthLbl.textContent = "";
    return;
  }
  const lvl = LEVELS[scorePassword(pwd)];
  strengthFill.style.width      = lvl.pct + "%";
  strengthFill.style.background = lvl.color;
  strengthLbl.textContent       = lvl.label;
  checkConfirm();
});

cfmInput.addEventListener("input", checkConfirm);

function checkConfirm() {
  const match = cfmInput.value === pwdInput.value;
  confirmHint.textContent = cfmInput.value && !match ? "As senhas não coincidem." : "";
  cfmInput.classList.toggle("invalid", cfmInput.value.length > 0 && !match);
}

function showError(msg) {
  errBox.textContent = msg;
  errBox.classList.add("show");
  okBox.classList.remove("show");
}
function showSuccess(msg) {
  okBox.textContent = msg;
  okBox.classList.add("show");
  errBox.classList.remove("show");
}
function clearAlerts() {
  errBox.classList.remove("show");
  okBox.classList.remove("show");
}
function setLoading(on) {
  btnSubmit.disabled = on;
  btnSubmit.innerHTML = on
    ? '<span class="spinner"></span>Criando conta...'
    : "Criar conta";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlerts();

  const name     = document.getElementById("name").value.trim();
  const email    = document.getElementById("email").value.trim();
  const password = pwdInput.value;
  const confirm  = cfmInput.value;

  if (!name || !email || !password || !confirm) {
    showError("Preencha todos os campos.");
    return;
  }
  if (password.length < 6) {
    showError("A senha deve ter pelo menos 6 caracteres.");
    return;
  }
  if (password !== confirm) {
    showError("As senhas não coincidem.");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(`${API}/auth/register`, {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Erro ao criar conta.");
      return;
    }

    showSuccess(`Conta criada! Bem-vindo, ${data.user.name}! 🎮`);
    setTimeout(() => { window.location.href = "index.html"; }, 900);
  } catch {
    showError("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
  } finally {
    setLoading(false);
  }
});
