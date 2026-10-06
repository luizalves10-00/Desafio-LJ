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
    const redirectParam = (params.get("redirect") || "").trim();
    const planParam = params.get("plan");

    setTimeout(() => {
      // 1. Fluxo de contratação / checkout
      if (redirectParam === "checkout" || redirectParam.includes("checkout")) {
        const planQuery = planParam ? `?plan=${encodeURIComponent(planParam)}` : "";
        window.location.href = `checkout${planQuery}`;
        return;
      }

      // Helper para normalizar destinos
      const sanitizeDest = (dest, fallback) => {
        if (!dest) return fallback;
        if (dest.includes("admin")) return "/admin";
        if (dest.includes("index") || dest.includes("app")) return "/app";
        return dest.replace(/\.html$/, "");
      };

      // 2. Administradores e Super Admins
      if (data.user && (data.user.is_admin || data.user.role === "admin" || data.user.role === "superadmin")) {
        if (redirectParam && (redirectParam.includes("admin") || redirectParam.includes("app") || redirectParam.includes("index"))) {
          window.location.href = sanitizeDest(redirectParam, "/admin");
          return;
        }
        window.location.href = sanitizeDest(data.redirect_to, "/admin");
        return;
      }

      // 3. Concurseiros / Estudantes (role padrão)
      if (redirectParam && !redirectParam.includes("admin")) {
        window.location.href = sanitizeDest(redirectParam, "/app");
        return;
      }

      window.location.href = sanitizeDest(data.redirect_to, "/app");
    }, 800);
  } catch {
    showError("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
  } finally {
    setLoading(false);
  }
});

// Propagar parâmetros de redirecionamento para o link de cadastro
(() => {
  const regLink = document.querySelector('.link-row a[href*="register"]');
  if (regLink && window.location.search) {
    regLink.href = `register${window.location.search}`;
  }
})();

