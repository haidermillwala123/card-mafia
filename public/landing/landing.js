// Card Mafia landing: scroll-driven globe, horizontal card gallery, path counter, safety checks.
// Scroll is read inside one rAF loop (no scroll listener). Prototype figures are sample.
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - t, 3);
const mobile = () => innerWidth <= 900;
const t0 = performance.now();
let prog = 0;

CMGlobe.init($('#globe'), {
  target: () => 62 - prog * 124,
  cx: () => (mobile() ? .5 : .7),
  rscale: () => (mobile() ? .95 : 1.0),
  tilt: () => 22 + prog * 14,
  reveal: () => ease(clamp((performance.now() - t0 - 300) / 2600)),
  spin: .007,
  drag: true,
  dragZone: () => scrollY < innerHeight * .9,
});

/* sample barcode: deterministic bars so it never changes between loads */
(() => {
  let s = 7, x = 0, out = '';
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  while (x < 278) { const w = 1 + Math.floor(rnd() * 4); if (rnd() > .38) out += `<rect x="${x}" y="0" width="${w}" height="56"/>`; x += w + 1 + Math.floor(rnd() * 3); }
  $('#bars').innerHTML = out;
})();

/* entrance reveals */
const rv = $$('.eyebrow,.mega,.big,.lede,.cta-row,.facts,.sample,.fine,.compare,.checks');
rv.forEach(el => el.classList.add('rv'));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
rv.forEach(el => io.observe(el));

/* safety checks tick in sequence once the panel is on screen */
let checked = false;
new IntersectionObserver(([e]) => {
  if (!e.isIntersecting || checked) return; checked = true;
  $$('#checks li').forEach((li, i) => setTimeout(() => li.classList.add('on'), 500 + i * 650));
  setTimeout(() => $('#verdict').classList.add('on'), 500 + 4 * 650);
}, { threshold: .5 }).observe($('#checks'));

const hs = $('.hscroll'), track = $('#track'), ps = $('.pathsec');
const prs = $('.printsec'), printer = $('#printer'), pass = $('#pass');
const TICKS = 38; // line feeds: the pass advances in steps, like a thermal printer
let lastTick = 0, heat = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const inView = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight * .5 && r.bottom > innerHeight * .5; };
const fmt = n => Math.round(n).toLocaleString('en-IN');
const hopLis = $$('#hops li');

/* theme toggle: the choice is saved and read back by the early script in <head> */
const root = document.documentElement;
const paintToggle = () => $$('[data-themebtn]').forEach(b => b.setAttribute('aria-label', root.dataset.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'));
$$('[data-themebtn]').forEach(b => b.addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.classList.add('theming'); root.dataset.theme = next; paintToggle();
  try { localStorage.setItem('cm-theme', next); } catch (e) { /* private mode: the choice just will not persist */ }
  setTimeout(() => root.classList.remove('theming'), 650);
}));
paintToggle();

/* headline words light up one by one as the heading scrolls in */
const scrubs = $$('.printsec .big,.hscroll .big,.pathsec .big,.checksec .big,.final .mega').map(h => {
  const words = [];
  const wrap = n => [...n.childNodes].forEach(c => {
    if (c.nodeType !== 3) return wrap(c);
    const f = document.createDocumentFragment();
    c.textContent.split(/(\s+)/).forEach(t => { if (!t.trim()) return f.append(t); const s = document.createElement('span'); s.className = 'sw'; s.textContent = t; words.push(s); f.append(s); });
    c.replaceWith(f);
  });
  wrap(h); return { h, words };
});

/* hero numbers count up once */
const counter = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; counter.unobserve(e.target);
  if (reducedMotion) return;
  const el = e.target, n = +el.dataset.count, s0 = performance.now();
  const step = now => { const k = clamp((now - s0) / 1400); el.textContent = fmt(n * ease(k)); if (k < 1) requestAnimationFrame(step); };
  step(s0);
}), { threshold: .6 });
$$('[data-count]').forEach(el => counter.observe(el));

/* pointer spotlight on cards and panels */
$$('.tile,.compare,.checks .core').forEach(el => {
  el.classList.add('spot');
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px'); });
});

/* airport ribbon: two rows drift in opposite directions, faster while you scroll */
const ribbons = $$('.rrow').map(r => { const t = r.firstElementChild; [...t.children].forEach(c => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); t.append(k); }); return { t, dir: +r.dataset.dir, x: 0, w: 0 }; });
const measure = () => ribbons.forEach(b => { b.w = b.t.scrollWidth / 2; });
measure(); addEventListener('resize', measure); if (document.fonts) document.fonts.ready.then(measure);
let lastY = scrollY, sv = 0;

/* footer wordmark rises letter by letter */
const fw = $('.foot-word');
fw.innerHTML = [...fw.textContent].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { fw.classList.add('in'); o.disconnect(); } }, { threshold: .35 }).observe(fw);

const spy = $$('.nav nav a').map(a => ({ a, s: $(a.getAttribute('href')) }));
const progressBar = $('.progress i');
function decorate(vh) {
  progressBar.style.setProperty('--p', prog.toFixed(4));
  let cur = null; spy.forEach(({ a, s }) => { if (s.getBoundingClientRect().top < vh * .45) cur = a; });
  spy.forEach(({ a }) => a.classList.toggle('on', a === cur));
  scrubs.forEach(({ h, words }) => {
    const r = h.getBoundingClientRect(); if (r.bottom < -40 || r.top > vh) return;
    const p = clamp((vh * .9 - r.top) / (vh * .45));
    words.forEach((s, i) => { s.style.opacity = (.16 + .84 * clamp(p * words.length * 1.15 - i)).toFixed(2); });
  });
  sv += (Math.abs(scrollY - lastY) - sv) * .12; lastY = scrollY;
  ribbons.forEach(b => { if (!b.w) return; b.x += b.dir * (reducedMotion ? 0 : .35 + sv * .5); b.t.style.transform = `translate3d(${-(((b.x % b.w) + b.w) % b.w)}px,0,0)`; });
}
function loop() {
  const vh = innerHeight, doc = document.documentElement;
  prog = clamp(scrollY / Math.max(1, doc.scrollHeight - vh));

  // horizontal gallery driven by vertical scroll (desktop only; mobile uses native swipe)
  if (!mobile()) {
    const r = hs.getBoundingClientRect(), p = clamp(-r.top / (r.height - vh));
    const travel = Math.max(0, track.scrollWidth - innerWidth);
    track.style.transform = `translate3d(${-p * travel}px,0,0)`;
  } else track.style.transform = '';
  $('#globe').style.opacity = (inView(hs) && !mobile()) || inView(prs) ? .28 : 1;

  // boarding pass: scroll progress -> stepped feed out of the slot; heat flashes on every line feed
  const pp0 = clamp(-prs.getBoundingClientRect().top / (prs.offsetHeight - vh)), raw = reducedMotion ? 1 : clamp(pp0 / .78);
  const sc = raw * TICKS, tick = Math.floor(sc), f = sc - tick;
  const q = raw >= 1 ? 1 : (tick + f * f * (3 - 2 * f)) / TICKS;
  if (tick !== lastTick) { heat = 1; lastTick = tick; } else heat *= .88;
  printer.style.setProperty('--k', clamp((printer.clientHeight - 40) / 590, .5, 1.1));
  printer.style.setProperty('--q', q);
  printer.style.setProperty('--heat', raw > 0 && raw < 1 ? heat : 0);
  pass.classList.toggle('done', raw >= 1);
  decorate(vh);

  // path chapter: counter, bar and hop chips follow scroll
  const pr = ps.getBoundingClientRect(), pp = mobile() ? clamp(1 - pr.top / vh * .6) : clamp(-pr.top / (pr.height - vh));
  const k = ease(clamp((pp - .12) / .6)), val = 280000 - 140000 * k;
  $('#hopN').textContent = fmt(val);
  $('#hopBar').style.transform = `scaleX(${val / 280000})`;
  $('#saveN').textContent = fmt(280000 - val);
  $('#save').classList.toggle('on', k > .95);
  const lit = Math.floor(clamp((pp - .1) / .55) * 4.999);
  hopLis.forEach((li, i) => li.classList.toggle('on', i < lit));
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
