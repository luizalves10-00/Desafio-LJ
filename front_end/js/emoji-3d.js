/* Renderização local compartilhada: HTML inicial, toasts, chat e jogos. */
(() => {
  'use strict';
  const scriptOrigin = (document.currentScript && document.currentScript.src) ? new URL(document.currentScript.src).origin : window.location.origin;
  const base = new URL('/assets/emoji/', scriptOrigin);
  const catalog = window.EMOJI_3D_CATALOG;
  const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
  const normalize = text => text.replace(/\uFE0F/g, '');
  const isEmoji = text => /\p{Emoji}/u.test(text) && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(text);
  const apiBase = new URL('/api/emoji/', scriptOrigin);
  const remote = new Map();
  const queue = [];
  let active = 0;
  function drain() {
    while (active < 2 && queue.length) {
      const { emoji, resolve, reject } = queue.shift();
      active++;
      const code = Array.from(normalize(emoji), c => c.codePointAt(0).toString(16)).join('-');
      fetch(new URL(`${code}.png`, apiBase), { credentials: 'same-origin', signal: AbortSignal.timeout(25000) })
        .then(async response => {
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
            const error = new Error('Emoji unavailable');
            error.retry = Math.max(1, Math.min(Number(response.headers.get('retry-after')) || 60, 86400));
            throw error;
          }
          const blob = await response.blob();
          if (blob.size > 1024 * 1024) throw new Error('Emoji too large');
          return URL.createObjectURL(blob);
        }).then(resolve, reject).finally(() => { active--; drain(); });
    }
  }
  function resolveRemote(emoji) {
    const key = normalize(emoji);
    if (remote.get(key)?.retryAt <= Date.now()) remote.delete(key);
    if (!remote.has(key)) {
      // Bounds memory and queued work even for unexpectedly large generated text.
      if (remote.size >= 256 || !/^https?:$/.test(apiBase.protocol)) return Promise.reject(new Error('Emoji limit'));
      const entry = { retryAt: Infinity };
      entry.promise = new Promise((resolve, reject) => { queue.push({ emoji, resolve, reject }); drain(); })
        .catch(error => { entry.retryAt = Date.now() + (error.retry || 60) * 1000; throw error; });
      remote.set(key, entry);
    }
    return remote.get(key).promise;
  }
  const visibility = new IntersectionObserver(entries => {
    for (const item of entries) if (item.isIntersecting) {
      visibility.unobserve(item.target);
      item.target.dispatchEvent(new Event('emoji-visible'));
    }
  }, { rootMargin: '160px' });
  const excluded = 'script,style,textarea,input,select,option,pre,code,[contenteditable],.emoji-3d';
  function create(emoji) {
    const entry = catalog[normalize(emoji)];
    if (!entry && !isEmoji(emoji)) return document.createTextNode(emoji);
    const wrapper = document.createElement('span');
    wrapper.className = 'emoji-3d';
    wrapper.dataset.emoji = emoji;
    wrapper.dataset.emojiName = entry?.name || emoji;
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', emoji);
    // Preserva textContent, cópia e comparações usadas pelos jogos.
    const native = document.createElement('span');
    native.className = 'emoji-3d-native';
    native.setAttribute('aria-hidden', 'true');
    native.textContent = emoji;
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.draggable = false;
    let attemptedRemote = false;
    const loadRemote = () => {
      if (attemptedRemote) return;
      attemptedRemote = true;
      wrapper.classList.add('emoji-3d-pending');
      resolveRemote(emoji).then(url => { img.loading = 'eager'; img.src = url; })
        .catch(() => { wrapper.classList.remove('emoji-3d-pending'); wrapper.classList.add('emoji-3d-failed'); });
    };
    img.addEventListener('load', () => wrapper.classList.remove('emoji-3d-pending', 'emoji-3d-failed'));
    img.addEventListener('error', () => {
      wrapper.classList.add('emoji-3d-failed');
      wrapper.classList.remove('emoji-3d-pending');
      if (!attemptedRemote) loadRemote();
    });
    if (entry) img.src = new URL(entry.file, base).href;
    else {
      wrapper.classList.add('emoji-3d-pending');
      wrapper.addEventListener('emoji-visible', loadRemote, { once: true });
      visibility.observe(wrapper);
    }
    wrapper.append(native, img);
    return wrapper;
  }
  function replaceText(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const parts = [...segmenter.segment(node.data)];
    if (!parts.some(p => catalog[normalize(p.segment)] || isEmoji(p.segment))) return;
    const fragment = document.createDocumentFragment();
    let text = '';
    for (const { segment } of parts) {
      if (catalog[normalize(segment)] || isEmoji(segment)) {
        if (text) { fragment.append(document.createTextNode(text)); text = ''; }
        fragment.append(create(segment));
      } else text += segment;
    }
    if (text) fragment.append(document.createTextNode(text));
    node.replaceWith(fragment);
  }
  function render(root) {
    if (root.nodeType === Node.TEXT_NODE) { replaceText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement.closest(excluded)
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceText);
  }
  // Options nativas não aceitam PNGs. Mantém o select como fonte do valor
  // e oferece a mesma escolha através de uma lista acessível com imagens.
  function enhanceSelect(select) {
    if (![...select.options].some(o => [...segmenter.segment(o.text)].some(p => catalog[normalize(p.segment)] || isEmoji(p.segment)))) return;
    if (select.parentElement?.classList.contains('emoji-select')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'emoji-select';
    select.before(wrapper);
    wrapper.append(select);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-select-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.id = `${select.id}-emoji-options`;
    menu.className = 'emoji-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', select.getAttribute('aria-label') || 'Opções');
    menu.hidden = true;
    button.setAttribute('aria-controls', menu.id);
    const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); };
    const sync = () => {
      button.textContent = select.selectedOptions[0]?.text || '';
      render(button);
      [...menu.children].forEach((child, i) => child.setAttribute('aria-selected', String(i === select.selectedIndex)));
    };
    [...select.options].forEach((option, i) => {
      const choice = document.createElement('button');
      choice.type = 'button'; choice.className = 'emoji-select-option';
      choice.setAttribute('role', 'option'); choice.tabIndex = -1;
      choice.textContent = option.text; choice.disabled = option.disabled;
      choice.addEventListener('click', () => {
        select.selectedIndex = i; sync(); close(); button.focus();
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      menu.append(choice);
    });
    const open = () => {
      menu.hidden = false; button.setAttribute('aria-expanded', 'true');
      menu.children[select.selectedIndex]?.focus();
    };
    button.addEventListener('click', () => menu.hidden ? open() : close());
    button.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    menu.addEventListener('keydown', e => {
      const options = [...menu.children].filter(o => !o.disabled);
      const index = options.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(); button.focus(); }
      if (e.key === 'Tab') close();
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1
          : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next]?.focus();
      }
    });
    document.addEventListener('click', e => { if (!wrapper.contains(e.target)) close(); });
    wrapper.addEventListener('focusout', e => { if (!wrapper.contains(e.relatedTarget)) close(); });
    select.addEventListener('change', sync);
    select.form?.addEventListener('reset', () => setTimeout(sync, 0));
    wrapper.append(button, menu); sync(); render(menu);
  }
  const images = new Map();
  function canvasImage(emoji) {
    const key = normalize(emoji), entry = catalog[key];
    if (!entry) return null;
    if (!images.has(key)) {
      const img = new Image(); img.src = new URL(entry.file, base).href;
      images.set(key, img);
    }
    const img = images.get(key);
    return img.complete && img.naturalWidth ? img : null;
  }
  function drawText(ctx, text, x, y) {
    const parts = [...segmenter.segment(text)].map(p => p.segment);
    const size = Number(ctx.font.match(/([\d.]+)px/)?.[1] || 16);
    const widths = parts.map(p => catalog[normalize(p)] ? size * 1.2 : ctx.measureText(p).width);
    const width = widths.reduce((sum, w) => sum + w, 0);
    const align = ctx.textAlign;
    let left = x - (align === 'center' ? width / 2 : ['right', 'end'].includes(align) ? width : 0);
    ctx.save(); ctx.textAlign = 'left';
    parts.forEach((part, i) => {
      const img = canvasImage(part);
      if (img) ctx.drawImage(img, left, y - size, widths[i], widths[i]);
      else ctx.fillText(part, left, y);
      left += widths[i];
    });
    ctx.restore();
  }
  function start() {
    document.querySelectorAll('select').forEach(enhanceSelect);
    render(document.body);
    const observer = new MutationObserver(records => {
      const roots = new Set();
      for (const record of records) {
        if (record.type === 'characterData') roots.add(record.target);
        else {
          record.addedNodes.forEach(node => roots.add(node));
          record.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && !node.isConnected) {
              visibility.unobserve(node);
              node.querySelectorAll('.emoji-3d').forEach(child => visibility.unobserve(child));
            }
          });
        }
      }
      for (const root of roots) if (root.isConnected) render(root);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    canvasImage('❤'); canvasImage('🔒');
  }
  window.Emoji3D = { create, render, drawText, enhanceSelect };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
