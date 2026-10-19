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
      }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
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

  /* ---------- the four flowing lines ----------
     One continuous ribbon of four parallel lines runs the length of the page.
     It is routed from the real positions of the sections, so it re-routes on
     resize: down one gutter, a long S-curve across the gap between sections,
     down the other gutter, and finally into the footer. The lines are drawn
     in as you scroll. They sit behind all content and ignore the pointer. */
  const initFlow = () => {
    const NS = 'http://www.w3.org/2000/svg';
    const COLORS = ['--sage', '--teal', '--orange', '--red'];
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'flow intro');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const lines = COLORS.map((c) => {
      const el = document.createElementNS(NS, 'path');
      el.style.stroke = `var(${c})`;
      svg.appendChild(el);
      return { el, total: 0, cum: null };
    });
    document.body.prepend(svg);

    let prefMaxY = null;     // running max of the centre-line y, for scroll lookup
    let built = false;

    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left + scrollX, r: r.right + scrollX, t: r.top + scrollY, b: r.bottom + scrollY, w: r.width, h: r.height };
    };
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

    /* segment builders: each returns cubic [a, c1, c2, b] */
    const straight = (a, b) => [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + 2 * (b[0] - a[0]) / 3, a[1] + 2 * (b[1] - a[1]) / 3], b];
    const sweep = (a, b) => {                      // vertical at both ends, long S between
      const dy = Math.max(60, b[1] - a[1]) * 0.9;
      return [a, [a[0], a[1] + dy], [b[0], b[1] - dy], b];
    };
    const catmull = (p) => {
      const s = [];
      for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p[i + 1];
        s.push([
          p1,
          [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
          [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
          p2,
        ]);
      }
      return s;
    };
    /* quarter-turn from a vertical run into a horizontal run along the footer, then off-screen */
    const intoFooter = (cur, yF, dir, W) => {
      const dy = Math.max(40, yF - cur[1]);
      const X = Math.max(dy * 1.7, 70);
      const b = [cur[0] + dir * X, yF];
      return [
        [cur, [cur[0], cur[1] + dy * 0.6], [b[0] - dir * X * 0.55, yF], b],
        straight(b, [dir > 0 ? W + 40 : -40, yF]),
      ];
    };

    const route = (W, L, R, narrow) => {
      const segs = [];
      const home = document.getElementById('home');
      const foot = q('.site-footer');
      let cur;

      if (home) {
        const hero = q('#home');
        const por = q('.portrait');
        const ids = ['about', 'skills', 'projects', 'adventures', 'work', 'contact'];
        const secs = ids.map((id) => q('#' + id));
        const pad = parseFloat(getComputedStyle(document.getElementById('about')).paddingTop) || 80;

        if (!narrow && por) {
          // weave behind the portrait, then run to the left gutter
          const pts = [
            [W + 40, por.t - 6],
            [Math.min(W - 6, por.r + 38), por.t + por.h * 0.2],
            [por.l + por.w * 0.45, por.t + por.h * 0.5],
            [Math.max(L + 24, por.l - 38), por.b - por.h * 0.12],
            [Math.max(L + 20, (por.l + L) / 2), hero.b - pad * 0.35],
            [L, secs[0].t + pad * 0.35],
            [L, secs[0].t + pad * 0.35 + 140],
          ];
          segs.push(...catmull(pts));
          cur = pts[pts.length - 1];
        } else {
          const a = [W + 40, hero.t + 20];
          const b = [R, hero.t + 90];
          segs.push([a, [a[0] - 100, a[1]], [b[0], b[1] - 50], b]);
          cur = [R, hero.b - pad * 0.5];
          segs.push(straight(b, cur));
          const next = [L, secs[0].t + pad * 0.7];
          segs.push(sweep(cur, next));
          cur = next;
        }

        // alternate gutters: about = left, skills = right, projects = left ...
        secs.forEach((s, i) => {
          const x = i % 2 === 0 ? L : R;
          if (i > 0) {
            const next = [x, s.t + pad * 0.7];
            segs.push(sweep(cur, next));
            cur = next;
          }
          const end = [x, s.b - pad * 0.5];
          segs.push(straight(cur, end));
          cur = end;
        });
        segs.push(...intoFooter(cur, foot.t + 10, -1, W));
      } else {
        // project page: right gutter, sweep to the left gutter, then out through the footer
        const hero = q('.proj-hero');
        const parts = q('#parts');
        const pad = parseFloat(getComputedStyle(document.getElementById('parts')).paddingTop) || 80;
        const a = [W + 40, hero.t + 30];
        const b = [R, hero.t + 150];
        segs.push([a, [a[0] - 120, a[1]], [b[0], b[1] - 60], b]);
        cur = [R, hero.b - pad * 0.5];
        segs.push(straight(b, cur));
        const next = [L, parts.t + pad * 0.7];
        segs.push(sweep(cur, next));
        cur = [L, parts.b - pad * 0.5];
        segs.push(straight(next, cur));
        segs.push(...intoFooter(cur, foot.t + 10, 1, W));
      }
      return segs;
    };

    const sample = (segs) => {
      const pts = [];
      segs.forEach((s, si) => {
        const [a, b, c, d] = s;
        const len = dist(a, b) + dist(b, c) + dist(c, d);
        const n = Math.max(4, Math.ceil(len / 10));
        for (let i = si ? 1 : 0; i <= n; i++) {
          const t = i / n, u = 1 - t;
          pts.push([
            u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
            u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
          ]);
        }
      });
      return pts;
    };

    const build = () => {
      svg.style.height = '0px';
      const W = root.clientWidth;
      const H = Math.max(document.body.scrollHeight, root.scrollHeight);
      svg.style.height = H + 'px';
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

      const wrapEl = document.querySelector('.wrap');
      const wr = wrapEl.getBoundingClientRect();
      const padPx = parseFloat(getComputedStyle(wrapEl).paddingLeft) || 20;
      const L = wr.left + scrollX + padPx * 0.5;
      const R = wr.right + scrollX - padPx * 0.5;
      const narrow = W < 860;
      const sp = narrow ? 3.2 : 5.5;

      const pts = sample(route(W, L, R, narrow));
      const n = pts.length;

      // normals from the sampled centre-line
      const nx = new Float32Array(n), ny = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = pts[Math.max(0, i - 1)], r = pts[Math.min(n - 1, i + 1)];
        const tx = r[0] - p[0], ty = r[1] - p[1];
        const l = Math.hypot(tx, ty) || 1;
        nx[i] = -ty / l; ny[i] = tx / l;
      }

      prefMaxY = new Float32Array(n);
      let m = -Infinity;
      for (let i = 0; i < n; i++) { m = Math.max(m, pts[i][1]); prefMaxY[i] = m; }

      lines.forEach((ln, k) => {
        const off = (k - 1.5) * sp;
        const cum = new Float32Array(n);
        let d = '', px = 0, py = 0, total = 0;
        for (let i = 0; i < n; i++) {
          const x = pts[i][0] + nx[i] * off, y = pts[i][1] + ny[i] * off;
          if (i) { total += Math.hypot(x - px, y - py); }
          cum[i] = total;
          d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
          px = x; py = y;
        }
        ln.el.setAttribute('d', d);
        ln.total = total;
        ln.cum = cum;
        if (reduceMotion.matches) {
          ln.el.style.strokeDasharray = 'none';
          ln.el.style.strokeDashoffset = '0';
        } else {
          ln.el.style.strokeDasharray = `${total} ${total}`;
        }
      });
      built = true;
      paint();
    };

    const paint = () => {
      if (!built || reduceMotion.matches) return;
      const thr = scrollY + innerHeight * 0.82;
      const n = prefMaxY.length;
      let lo = 0, hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (prefMaxY[mid] > thr) hi = mid; else lo = mid + 1;
      }
      const idx = prefMaxY[lo] > thr ? lo : n - 1;
      lines.forEach((ln) => { ln.el.style.strokeDashoffset = String(ln.total - ln.cum[idx]); });
    };

    let tick = 0;
    const onScroll = () => { if (!tick) tick = requestAnimationFrame(() => { tick = 0; paint(); }); };
    let timer = 0;
    const rebuild = () => { clearTimeout(timer); timer = setTimeout(build, 120); };

    // start hidden so the first paint draws the lines in
    build();
    if (!reduceMotion.matches) {
      lines.forEach((ln) => { ln.el.style.strokeDashoffset = String(ln.total); });
      requestAnimationFrame(() => requestAnimationFrame(paint));
      setTimeout(() => svg.classList.remove('intro'), 1800);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', rebuild);
    window.addEventListener('load', rebuild);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
    if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(document.body);
    reduceMotion.addEventListener && reduceMotion.addEventListener('change', build);
  };
  initFlow();

  /* ---------- custom cursor (fine pointers only; touch keeps the normal cursor) ----------
     A small angular pointer (tip on the true hotspot) plus a thin square that follows
     a beat behind. Over links and buttons the square turns into a diamond. The native
     cursor is only hidden after the first pointer move, so it can never vanish. */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (finePointer.matches) {
    const ptr = document.createElement('div');
    ptr.className = 'cursor-pointer';
    ptr.setAttribute('aria-hidden', 'true');
    ptr.innerHTML = '<svg viewBox="0 0 16 20"><path d="M1 1V17.5L5.2 13.3L8.4 19.5L11.2 18.2L8.1 12.2L14 11.6Z"/></svg>';
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    ring.appendChild(document.createElement('i'));
    document.body.append(ring, ptr);

    const interactive = 'a, button, [role="button"], summary, label, [data-cursor="hover"]';
    let mx = 0, my = 0, rx = 0, ry = 0, shown = false, frame = 0;

    const tick = () => {
      const ease = reduceMotion.matches ? 1 : 0.32;
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
      ptr.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (!shown) {
        shown = true;
        rx = mx; ry = my;
        root.classList.add('has-cursor', 'cursor-on');
      }
      run();
    }, { passive: true });

    document.addEventListener('pointerover', (e) => {
      if (!(e.target instanceof Element)) return;
      root.classList.toggle('cursor-hover', Boolean(e.target.closest(interactive)));
    });
    document.addEventListener('pointerdown', () => root.classList.add('cursor-down'));
    document.addEventListener('pointerup', () => root.classList.remove('cursor-down'));
    root.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
    root.addEventListener('mouseenter', () => { if (shown) root.classList.add('cursor-on'); });
  }
})();
