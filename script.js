(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- mobile menu ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('nav-links');

  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('open', open);
    };
    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.site-header')) setOpen(false);
    });
  }

  /* ---------- highlight the nav link for the section in view ---------- */
  const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  if (navLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.removeAttribute('aria-current'));
        const link = byId.get(entry.target.id);
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- reveal on scroll ---------- */
  const revealItems = [...document.querySelectorAll('.reveal')];
  if (revealItems.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      revealItems.forEach((el) => io.observe(el));
    } else {
      revealItems.forEach((el) => el.classList.add('in'));
    }
  }

  /* ---------- back to top ---------- */
  const toTop = document.querySelector('.to-top');
  if (toTop) {
    const update = () => toTop.classList.toggle('show', window.scrollY > 600);
    update();
    window.addEventListener('scroll', update, { passive: true });
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      const brand = document.querySelector('.brand');
      if (brand) brand.focus({ preventScroll: true });
    });
  }

  /* ---------- custom cursor (fine pointers only; touch keeps the normal cursor) ---------- */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (finePointer.matches) {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    ring.appendChild(document.createElement('i'));
    document.body.append(ring, dot);
    root.classList.add('has-cursor');

    const interactive = 'a, button, [role="button"], summary, label, .skill, .tag, [data-cursor="hover"]';
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let shown = false;
    let frame = 0;

    const tick = () => {
      const ease = reduceMotion.matches ? 1 : 0.18;   // no trailing when reduced motion is on
      rx += (mx - rx) * ease;
      ry += (my - ry) * ease;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      frame = (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame) frame = requestAnimationFrame(tick); };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (!shown) {
        shown = true;
        rx = mx;
        ry = my;
        root.classList.add('cursor-on');
      }
      run();
    }, { passive: true });

    document.addEventListener('pointerover', (e) => {
      if (!(e.target instanceof Element)) return;
      root.classList.toggle('cursor-hover', Boolean(e.target.closest(interactive)));
      const themed = e.target.closest('[data-cursor-theme]');
      if (themed) root.dataset.cursorTheme = themed.dataset.cursorTheme;
      else delete root.dataset.cursorTheme;
    });
    document.addEventListener('pointerdown', () => root.classList.add('cursor-down'));
    document.addEventListener('pointerup', () => root.classList.remove('cursor-down'));
    root.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
    root.addEventListener('mouseenter', () => { if (shown) root.classList.add('cursor-on'); });
  }
})();
