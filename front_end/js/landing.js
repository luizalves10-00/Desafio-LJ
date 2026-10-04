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
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold:.12, rootMargin:'0px 0px -40px' });
  document.querySelectorAll('.reveal').forEach(item => observer.observe(item));
})();
