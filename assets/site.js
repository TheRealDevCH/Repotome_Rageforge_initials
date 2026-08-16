/* ==========================================================================
   Rageforge Mirror Cube — shared site behaviour
   Nav state, scroll progress, reveal-on-scroll, active section tracking.
   ========================================================================== */

(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sticky nav ---------- */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- scroll progress bar ---------- */
  const bar = document.getElementById('progress');
  if (bar) {
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ---------- reveal on scroll ---------- */
  const targets = document.querySelectorAll('.reveal, .reveal-l, .reveal-scale');
  if (targets.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('in'));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            /* stagger siblings inside the same grid/list */
            const sibs = el.parentElement ? Array.from(el.parentElement.children) : [];
            const i = Math.max(0, sibs.indexOf(el));
            el.style.transitionDelay = Math.min(i * 60, 420) + 'ms';
            el.classList.add('in');
            io.unobserve(el);
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -7% 0px' }
      );
      targets.forEach((el) => io.observe(el));
    }
  }

  /* ---------- active nav section ---------- */
  const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((a) =>
            a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id)
          );
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => spy.observe(s));
  }
})();
