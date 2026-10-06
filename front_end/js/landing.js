(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.mobile-menu');
  const setHeader = () => header.classList.toggle('scrolled', scrollY > 16);
  addEventListener('scroll', setHeader, { passive:true });
  setHeader();

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.setAttribute('aria-label', open ? 'Abrir menu' : 'Fechar menu');
    toggle.querySelector('use').setAttribute('href', open ? '#icon-menu' : '#icon-close');
    menu.hidden = open;
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    toggle.querySelector('use').setAttribute('href', '#icon-menu');
  }));

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach(item => item.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold:.12, rootMargin:'0px 0px -40px' });
    document.querySelectorAll('.reveal').forEach(item => observer.observe(item));
  }

  // ─── BILLING TOGGLE (MENSAL / ANUAL) ───
  const billingToggle = document.getElementById('billing-toggle');
  const labelMonthly = document.getElementById('label-monthly');
  const labelYearly = document.getElementById('label-yearly');
  const cardMonthly = document.getElementById('card-monthly');
  const cardYearly = document.getElementById('card-yearly');

  function setBilling(isYearly) {
    if (!billingToggle) return;
    billingToggle.setAttribute('aria-checked', String(isYearly));
    if (labelMonthly) labelMonthly.classList.toggle('active', !isYearly);
    if (labelYearly) labelYearly.classList.toggle('active', isYearly);
    if (cardMonthly && cardYearly) {
      if (isYearly) {
        cardYearly.classList.add('pricing-featured');
        cardMonthly.classList.remove('pricing-featured');
      } else {
        cardMonthly.classList.add('pricing-featured');
        cardYearly.classList.remove('pricing-featured');
      }
    }
  }

  if (billingToggle) {
    billingToggle.addEventListener('click', () => {
      const isYearly = billingToggle.getAttribute('aria-checked') !== 'true';
      setBilling(isYearly);
    });
    if (labelMonthly) labelMonthly.addEventListener('click', () => setBilling(false));
    if (labelYearly) labelYearly.addEventListener('click', () => setBilling(true));
  }

  // ─── STRIPE CHECKOUT HANDLERS ───
  function attachCheckoutHandlers() {
    document.querySelectorAll('.btn-checkout').forEach(btn => {
      if (btn._hasCheckoutHandler) return;
      btn._hasCheckoutHandler = true;
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const plan = btn.getAttribute('data-plan') || 'monthly';
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>Carregando checkout...</span>';

        try {
          const authRes = await fetch('/api/auth/me', { credentials: 'include' });
          if (!authRes.ok) {
            window.location.href = `login?redirect=checkout&plan=${encodeURIComponent(plan)}`;
            return;
          }
          window.location.href = `checkout?plan=${encodeURIComponent(plan)}`;
        } catch (err) {
          console.error('Erro ao redirecionar para o checkout:', err);
          window.location.href = `checkout?plan=${encodeURIComponent(plan)}`;
        } finally {
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }, 1500);
        }
      });
    });
  }

  // ─── CARREGAR PLANOS DINÂMICOS DA API ───
  async function loadDynamicPlans() {
    const grid = document.getElementById('pricing-grid');
    if (!grid) return;

    try {
      const res = await fetch('/api/plans');
      if (!res.ok) return;
      const data = await res.json();
      const plans = data.plans || [];
      if (!plans || plans.length === 0) return;

      // Card padrão Aprendiz (Gratuito)
      const freeCard = `
        <article class="pricing-card" id="card-free">
          <div class="pricing-badge-slot">
            <span class="plan-tag">Gratuito Permanente</span>
          </div>
          <div class="pricing-header">
            <div class="plan-emoji">🐣</div>
            <h3>Aprendiz</h3>
            <p class="plan-sub">Foco, tarefas e gamificação essencial para construir sua constância diária.</p>
          </div>
          <div class="pricing-cost">
            <div class="price-val">
              <span class="currency">R$</span>
              <span class="number">0</span>
            </div>
            <span class="period">/ sempre</span>
          </div>
          <a class="btn btn-glass btn-large btn-plan" href="register">
            Começar Grátis
          </a>
          <div class="guarantee-text">Sem cartão de crédito. Crie sua conta em 30s.</div>
          <div class="plan-divider"></div>
          <ul class="pricing-features">
            <li><svg><use href="#icon-check"></use></svg> <span><strong>Pomodoro RPG</strong> gamificado com contagem de foco</span></li>
            <li><svg><use href="#icon-check"></use></svg> <span><strong>18 minijogos</strong> do Arcade com pausas anti-abuso</span></li>
            <li><svg><use href="#icon-check"></use></svg> <span><strong>33 conquistas</strong>, sistema de EXP, streaks e níveis</span></li>
            <li><svg><use href="#icon-check"></use></svg> <span><strong>3 perguntas/dia</strong> com Mentor IA Gemini</span></li>
            <li><svg><use href="#icon-check"></use></svg> <span><strong>Degustação de 3 questões</strong> de concurso por dia</span></li>
            <li><svg><use href="#icon-check"></use></svg> <span>Tema padrão escuro imersivo</span></li>
          </ul>
        </article>
      `;

      let cardsHtml = freeCard;

      plans.forEach(plan => {
        const isYearly = plan.interval === 'year';
        const isMonthly = plan.interval === 'month' && plan.interval_count === 1;
        const isFeatured = isYearly || (plan.badge && plan.badge.toUpperCase().includes('POPULAR'));
        const cardClass = isFeatured ? 'pricing-card pricing-featured' : 'pricing-card pricing-pro';
        const cardId = isYearly ? 'card-yearly' : (isMonthly ? 'card-monthly' : `card-${plan.plan_key}`);

        let badgeSlot = '';
        if (plan.badge) {
          badgeSlot = `<div class="pricing-badge-slot"><span class="${isFeatured ? 'plan-badge-popular' : 'plan-badge-trial'}">${plan.badge}</span></div>`;
        } else if (plan.trial_days > 0) {
          badgeSlot = `<div class="pricing-badge-slot"><span class="plan-badge-trial">✨ ${plan.trial_days} DIAS GRÁTIS</span></div>`;
        } else {
          badgeSlot = `<div class="pricing-badge-slot"><span class="plan-tag">Plano Pro</span></div>`;
        }

        const priceClean = plan.formatted_price.replace('R$ ', '');
        const periodText = isYearly ? '/ ano' : (isMonthly ? '/ mês' : `/ ${plan.interval_label.toLowerCase()}`);
        const equivText = isYearly ? `<small>(equivale a R$ ${(plan.price_amount / 12).toFixed(2).replace('.', ',')}/mês)</small>` : '';

        const perms = plan.permissions || {};
        const features = [];
        if (plan.trial_days > 0) {
          features.push(`<li><svg class="feat-star"><use href="#icon-spark"></use></svg> <span><strong>${plan.trial_days} dias grátis</strong> com cancelamento em 1 clique</span></li>`);
        }
        if (isYearly) {
          features.push(`<li><svg class="feat-star"><use href="#icon-spark"></use></svg> <span><strong>Economia de 17%</strong> em relação ao plano mensal</span></li>`);
        }
        if (perms.can_access_unlimited_ai) {
          features.push(`<li><svg><use href="#icon-check"></use></svg> <span><strong>Mentor IA ILIMITADO</strong> com analogias personalizadas</span></li>`);
        }
        if (perms.concurseiro_simulados) {
          features.push(`<li><svg><use href="#icon-check"></use></svg> <span><strong>Simulados cronometrados</strong> (Cebraspe, FGV, FCC, Vunesp)</span></li>`);
        }
        if (perms.ai_commented_answers) {
          features.push(`<li><svg><use href="#icon-check"></use></svg> <span><strong>Gabaritos comentados com IA</strong> e diagnóstico de erros</span></li>`);
        }
        if (perms.can_access_advanced_analytics) {
          features.push(`<li><svg><use href="#icon-check"></use></svg> <span><strong>Métricas avançadas</strong> e taxa de assertividade por matéria</span></li>`);
        }
        if (perms.can_access_all_themes) {
          features.push(`<li><svg><use href="#icon-check"></use></svg> <span><strong>Todos os 6 temas</strong> raros e lendários liberados</span></li>`);
        }
        if (perms.priority_support) {
          features.push(`<li><svg><use href="#icon-check"></use></svg> <span><strong>Suporte prioritário</strong> direto com os desenvolvedores</span></li>`);
        }
        if (features.length === 0) {
          features.push(`<li><svg><use href="#icon-check"></use></svg> <span>Acesso completo às ferramentas do plano</span></li>`);
        }

        cardsHtml += `
          <article class="${cardClass}" id="${cardId}">
            ${badgeSlot}
            <div class="pricing-header">
              <div class="plan-emoji">${plan.emoji || '🛡️'}</div>
              <h3>${plan.name}</h3>
              <p class="plan-sub">${plan.description || 'Acesso completo às ferramentas de alta performance.'}</p>
            </div>
            <div class="pricing-cost">
              <div class="price-val">
                <span class="currency">R$</span>
                <span class="number">${priceClean}</span>
              </div>
              <span class="period">${periodText} ${equivText}</span>
            </div>
            <button class="btn btn-primary btn-large btn-plan btn-checkout ${isFeatured ? 'btn-glow' : ''}" data-plan="${plan.plan_key}">
              ${plan.trial_days > 0 ? `Testar ${plan.trial_days} Dias Grátis` : 'Assinar Agora'} <svg><use href="#icon-arrow"></use></svg>
            </button>
            <div class="guarantee-text">${plan.trial_days > 0 ? 'Cancele quando quiser. Cobrança só no ' + (plan.trial_days + 1) + 'º dia.' : 'Acesso imediato após confirmação.'}</div>
            <div class="plan-divider"></div>
            <ul class="pricing-features">
              ${features.join('')}
            </ul>
          </article>
        `;
      });

      grid.innerHTML = cardsHtml;
      attachCheckoutHandlers();

      if (window.Emoji3D && window.Emoji3D.render) {
        window.Emoji3D.render(grid);
      }
    } catch (err) {
      console.warn('Erro ao carregar planos dinâmicos na landing/planos:', err);
    }
  }

  attachCheckoutHandlers();
  loadDynamicPlans();

  // ─── VERIFICAÇÃO DE SESSÃO ATIVA (UX PRO) ───
  fetch('/api/auth/me', { credentials: 'include' })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && data.user) {
        const dest = (data.user.is_admin || data.user.role === 'admin' || data.user.role === 'superadmin') ? '/admin' : '/app';
        document.querySelectorAll('.desktop-login, .mobile-menu a[href="login"], a[href="login"]').forEach(el => {
          if (el.classList.contains('desktop-login') || el.textContent.includes('Entrar') || el.textContent.includes('Já tenho uma conta')) {
            el.textContent = 'Acessar App 🚀';
            el.href = dest;
          }
        });
      }
    })
    .catch(() => {});
})();


