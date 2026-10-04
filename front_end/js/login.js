const API = "/api";

const form      = document.getElementById("login-form");
const btnSubmit = document.getElementById("btn-submit");
const errBox    = document.getElementById("alert-error");
const okBox     = document.getElementById("alert-success");

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
    ? '<span class="spinner"></span>Entrando...'
    : "Entrar";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlerts();

  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showError("Preencha e-mail e senha.");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(`${API}/auth/login`, {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Erro ao entrar.");
      return;
    }

    showSuccess(`Bem-vindo de volta, ${data.user.name}! 🎮`);

    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get("redirect");
    const planParam = params.get("plan");

    setTimeout(() => {
      if (redirectParam === "checkout" && planParam) {
        window.location.href = `checkout.html?plan=${encodeURIComponent(planParam)}`;
        return;
      }
      window.location.href = "index.html";
    }, 800);
  } catch {
    showError("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
  } finally {
    setLoading(false);
  }
});

// Propagar parâmetros de redirecionamento para o link de cadastro
(() => {
  const regLink = document.querySelector('.link-row a[href*="register.html"]');
  if (regLink && window.location.search) {
    regLink.href = `register.html${window.location.search}`;
  }
})();
