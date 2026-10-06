/**
 * LevelUp Study – Web Notification Engine
 * Gerencia permissões, modal customizado e disparo de notificações nativas
 * para Pomodoro, Pausas e Sincronização de Calendário.
 */

class StudyNotifier {
  constructor() {
    this.modalId = "notification-modal";
    this.iconUrl = "favicon.ico";
  }

  get isSupported() {
    return "Notification" in window;
  }

  get permission() {
    return this.isSupported ? Notification.permission : "denied";
  }

  requestPermissionWithModal() {
    if (!this.isSupported) {
      if (typeof showToast === "function") {
        showToast("Seu navegador não suporta notificações nativas.", "warn");
      }
      return;
    }
    if (this.permission === "granted") return;
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.style.display = "flex";
      modal.classList.add("active");
    }
  }

  closePermissionModal() {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.style.display = "none";
      modal.classList.remove("active");
    }
  }

  async confirmPermission() {
    if (!this.isSupported) return;
    try {
      const perm = await Notification.requestPermission();
      this.closePermissionModal();
      if (perm === "granted") {
        this.sendNotification("🔔 Alertas Nativos Ativados!", {
          body: "Você receberá avisos quando seus ciclos de foco e pausas terminarem.",
          tag: "welcome-notif"
        });
        if (typeof showToast === "function") {
          showToast("Notificações nativas ativadas com sucesso!", "ok");
        }
      } else if (perm === "denied") {
        if (typeof showToast === "function") {
          showToast("Permissão de notificações bloqueada nas configurações do navegador.", "warn");
        }
      }
    } catch (e) {
      console.error("Erro ao solicitar permissão de notificações:", e);
      this.closePermissionModal();
    }
  }

  sendNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== "granted") return null;

    const defaultOptions = {
      icon: this.iconUrl,
      badge: this.iconUrl,
      vibrate: [200, 100, 200],
      ...options
    };

    try {
      const notif = new Notification(title, defaultOptions);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return notif;
    } catch (err) {
      console.warn("Falha ao instanciar notificação:", err);
      return null;
    }
  }

  notifyPomodoroEnd(monsterName = "Monstro da Procrastinação") {
    return this.sendNotification("⚔️ Batalha de Foco Vencida!", {
      body: `Você superou o ${monsterName}. Hora de uma pausa estratégica de 5 minutos!`,
      tag: "pomodoro-end"
    });
  }

  notifyBreakEnd(monsterName = "Próximo Desafio") {
    return this.sendNotification("⚡ Fim do Descanso! Hora de Estudar!", {
      body: `Sua pausa terminou. Prepare-se para enfrentar o ${monsterName}!`,
      tag: "break-end"
    });
  }

  notifyCalendarSync(count = 1) {
    return this.sendNotification("📅 Google Calendar Sincronizado!", {
      body: `${count} missão(ões) de estudo atualizada(s) com sucesso na sua agenda.`,
      tag: "calendar-sync"
    });
  }
}

// Inicializa no escopo global
window.studyNotifier = new StudyNotifier();

