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

  // ─── STRIPE CHECKOUT HANDLER (7 DIAS GRÁTIS - WHITE-LABEL) ───
  document.querySelectorAll('.btn-checkout').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const plan = btn.getAttribute('data-plan') || 'monthly';
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>Carregando checkout...</span>';

      try {
        // 1. Verificar se o usuário já está autenticado
        const authRes = await fetch('/api/auth/me', { credentials: 'include' });
        if (!authRes.ok) {
          // Não autenticado: direcionar para login com retorno automático ao checkout white-label
          window.location.href = `login.html?redirect=checkout&plan=${encodeURIComponent(plan)}`;
          return;
        }

        // 2. Autenticado: direcionar para a tela customizada 100% white-label do LevelUp Study
        window.location.href = `checkout.html?plan=${encodeURIComponent(plan)}`;
      } catch (err) {
        console.error('Erro ao redirecionar para o checkout:', err);
        window.location.href = `checkout.html?plan=${encodeURIComponent(plan)}`;
      }
    });
  });
})();
