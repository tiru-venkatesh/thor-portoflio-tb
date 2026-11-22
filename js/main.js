const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

const hero = $(".hero");
const header = $(".site-header");
const flash = $(".flash");
const videos = { blue: $(".storm-blue"), red: $(".storm-red") };
let storm = "blue";
let onScrollStorm = () => {};      // set below once the storm layer exists

if (reduceMotion) {
  videos.blue.removeAttribute("autoplay");
  videos.blue.pause();
  videos.red.remove();
}

/* ---------- Header + scroll drift ---------- */
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const progress = Math.min(scrollY / hero.offsetHeight, 1);
    header.classList.toggle("scrolled", scrollY > 40);
    hero.style.setProperty("--sy", progress.toFixed(3));
    hero.style.setProperty("--fade", Math.min(progress * 1.6, 1).toFixed(3));
    moveRelics();
    onScrollStorm();
    ticking = false;
  });
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- Blue storm <-> red storm ---------- */
function setStorm(name) {
  storm = name;
  hero.dataset.storm = name;
  for (const [key, video] of Object.entries(videos)) {
    video.classList.toggle("active", key === name);
    if (key === name) video.play().catch(() => {});
    else setTimeout(() => { if (storm !== key) video.pause(); }, 1600);   // after the crossfade
  }
}

if (!reduceMotion) {
  /* ---------- Mouse parallax ---------- */
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
    hero.style.setProperty("--my", ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
  });

  /* ---------- Lightning flash + screen shake ---------- */
  function strike() {
    flash.classList.remove("on");
    hero.classList.remove("shake");
    void flash.offsetWidth;                       // restart the animations
    flash.classList.add("on");
    hero.classList.add("shake");
    dispatchEvent(new Event("thor:strike"));
  }
  function scheduleStrike() {
    setTimeout(() => { if (!document.hidden) strike(); scheduleStrike(); }, 3500 + Math.random() * 5000);
  }
  addEventListener("thor:ready", () => {
    setTimeout(strike, 350);
    scheduleStrike();
    setInterval(() => setStorm(storm === "blue" ? "red" : "blue"), 9000);
  }, { once: true });
  hero.addEventListener("click", (e) => { if (!e.target.closest("a, button")) strike(); });

  /* ---------- Cursor sparks (colour follows the storm) ---------- */
  const canvas = $(".sparks");
  const ctx = canvas.getContext("2d");
  const palette = { blue: ["#bfe3ff", "#2f9bff"], red: ["#ffc2c9", "#ff2d46"] };
  let sparks = [];

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = hero.clientWidth * dpr;
    canvas.height = hero.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    for (let i = 0; i < 2; i++) {
      sparks.push({ x: e.clientX - r.left, y: e.clientY - r.top, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 1 });
    }
    if (sparks.length === 2) requestAnimationFrame(drawSparks);
  });

  function drawSparks() {
    const [fill, glow] = palette[storm];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fill;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    sparks = sparks.filter((s) => s.life > 0);
    for (const s of sparks) {
      s.x += s.vx; s.y += s.vy; s.life -= 0.035;
      ctx.globalAlpha = Math.max(s.life, 0);
      ctx.fillRect(s.x, s.y, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    if (sparks.length) requestAnimationFrame(drawSparks);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/* ---------- Thor cut-out: follows the mouse, flashes on every lightning strike ---------- */
const thor = $(".thor");
if (thor && !reduceMotion) {
  const about = $("#about");
  about.addEventListener("pointermove", (e) => {
    const r = about.getBoundingClientRect();
    thor.style.setProperty("--tx", ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
    thor.style.setProperty("--ty", ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
  });
  addEventListener("thor:strike", () => {
    thor.classList.remove("zap");
    void thor.offsetWidth;
    thor.classList.add("zap");
  });
}

/* ---------- Weapons in the backgrounds: drift and turn while scrolling ---------- */
const relics = $$(".relic").map((el) => ({ el, section: el.closest(".section"), speed: +el.dataset.speed, rot: +el.dataset.rot, visible: false }));

function moveRelics() {
  if (reduceMotion) return;
  for (const r of relics) {
    if (!r.visible) continue;
    const box = r.section.getBoundingClientRect();
    const offset = box.top + box.height / 2 - innerHeight / 2;      // 0 when the section is centred
    r.el.style.transform = `translate3d(0, ${(offset * r.speed).toFixed(1)}px, 0) rotate(${(r.rot + offset * 0.02).toFixed(1)}deg)`;
  }
}
if (reduceMotion) {
  relics.forEach((r) => (r.el.style.transform = `rotate(${r.rot}deg)`));
} else {
  const relicObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) relics.forEach((r) => { if (r.section === entry.target) r.visible = entry.isIntersecting; });
    moveRelics();
  }, { rootMargin: "20% 0px" });
  new Set(relics.map((r) => r.section)).forEach((s) => relicObserver.observe(s));
}

/* ---------- Scroll storm: scrolling down = blue bolts, scrolling up = red bolts ---------- */
if (!reduceMotion) {
  const fx = $(".fx");
  const fxFlash = $(".fx-flash");
  const canvas = $(".fx-bolts");
  const bctx = canvas.getContext("2d");
  const boltColors = { blue: "#2f9bff", red: "#ff2d46" };
  let live = [];
  let lastY = scrollY, lastT = performance.now(), lastBolt = 0, chargeTimer = 0;

  function sizeCanvas() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();
  addEventListener("resize", sizeCanvas);

  function jag(x1, y1, x2, y2, spread, out) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 12) return out.push([x1, y1, x2, y2]);
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * spread;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * spread * 0.4;
    jag(x1, y1, mx, my, spread / 2, out);
    jag(mx, my, x2, y2, spread / 2, out);
    if (Math.random() < 0.14 && len > 40) {
      const a = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - 0.5) * 1.2;
      jag(mx, my, mx + Math.cos(a) * len * 0.6, my + Math.sin(a) * len * 0.6, spread / 2, out);
    }
  }

  function boltStrike(color) {
    const x = innerWidth * (0.08 + Math.random() * 0.84);
    const y = innerHeight * (0.45 + Math.random() * 0.4);
    const segs = [];
    jag(x + (Math.random() - 0.5) * 160, 0, x, y, Math.max(90, innerHeight * 0.22), segs);
    live.push({ segs, color: boltColors[color], life: 1 });
    fx.dataset.flash = color;
    fxFlash.classList.remove("on");
    void fxFlash.offsetWidth;
    fxFlash.classList.add("on");
    dispatchEvent(new Event("thor:strike"));
    if (live.length === 1) requestAnimationFrame(drawBolts);
  }

  function drawBolts() {
    bctx.clearRect(0, 0, innerWidth, innerHeight);
    live = live.filter((b) => b.life > 0);
    for (const b of live) {
      bctx.globalAlpha = Math.max(b.life, 0);
      bctx.lineCap = "round";
      bctx.strokeStyle = b.color;
      bctx.shadowColor = b.color;
      bctx.shadowBlur = 22;
      bctx.lineWidth = 2.6;
      bctx.beginPath();
      b.segs.forEach((s) => { bctx.moveTo(s[0], s[1]); bctx.lineTo(s[2], s[3]); });
      bctx.stroke();
      bctx.shadowBlur = 0;
      bctx.strokeStyle = "#fff";
      bctx.lineWidth = 1;
      bctx.stroke();
      b.life -= 0.035;
    }
    bctx.globalAlpha = 1;
    if (live.length) requestAnimationFrame(drawBolts);
    else bctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  onScrollStorm = () => {
    const now = performance.now();
    const dy = scrollY - lastY;
    const speed = Math.abs(dy) / Math.max(now - lastT, 1);          // px per ms
    const max = document.documentElement.scrollHeight - innerHeight;
    fx.style.setProperty("--p", (max > 0 ? scrollY / max : 0).toFixed(3));

    if (speed > 0.5) {                                              // brighten the glows while scrolling fast
      fx.classList.add("charged");
      clearTimeout(chargeTimer);
      chargeTimer = setTimeout(() => fx.classList.remove("charged"), 700);
    }
    if (speed > 1.2 && now - lastBolt > 800) {
      lastBolt = now;
      boltStrike(dy > 0 ? "blue" : "red");
    }
    lastY = scrollY;
    lastT = now;
  };

  // A quiet ambient bolt every so often once the hero is out of view
  let ambient = "blue";
  setInterval(() => {
    if (document.hidden || scrollY < hero.offsetHeight * 0.6) return;
    ambient = ambient === "blue" ? "red" : "blue";
    boltStrike(ambient);
  }, 9000);
}

/* ---------- Reveal on scroll + count-up numbers ---------- */
function countUp(el) {
  const target = parseFloat(el.dataset.count);
  const decimals = Number(el.dataset.decimals || 0);
  const prefix = el.dataset.prefix || "";
  const suffix = el.dataset.suffix || "";
  const start = performance.now();

  (function frame(now) {
    const t = Math.min((now - start) / 1600, 1);
    el.textContent = prefix + (target * (1 - Math.pow(1 - t, 3))).toFixed(decimals) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  })(start);
}

const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("in");
    const number = $("[data-count]", entry.target);
    if (number && !reduceMotion) countUp(number);
    revealObserver.unobserve(entry.target);
  }
}, { threshold: 0.2 });
$$(".reveal").forEach((el) => revealObserver.observe(el));

/* ---------- Highlight the current section in the menu ---------- */
const menuLinks = $$(".menu a");
const sectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    menuLinks.forEach((link) => {
      if (link.getAttribute("href") === "#" + entry.target.id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }
}, { rootMargin: "-45% 0px -50% 0px" });
$$("section[id]").forEach((s) => sectionObserver.observe(s));

/* ---------- Loader: progress bar, then the doors open ---------- */
const loader = $(".loader");
const loaderBar = $(".loader-bar span");
const loaderPct = $(".loader-pct");

function openLoader() {
  loaderPct.textContent = "100%";
  loaderBar.style.width = "100%";
  loader.classList.add("open");
  document.body.classList.remove("loading");
  dispatchEvent(new Event("thor:ready"));
  setTimeout(() => loader.remove(), 1000);
}

if (reduceMotion) {
  loader.remove();
  document.body.classList.remove("loading");
} else {
  let progress = 0;
  let videoReady = videos.blue.readyState >= 3;
  const startedAt = performance.now();
  videos.blue.addEventListener("canplaythrough", () => (videoReady = true), { once: true });
  setTimeout(() => (videoReady = true), 4000);            // never block longer than 4s

  (function tick() {
    progress = Math.min(progress + ((videoReady ? 100 : 88) - progress) * 0.06 + 0.2, 100);
    loaderBar.style.width = progress + "%";
    loaderPct.textContent = Math.floor(progress) + "%";
    if (progress >= 99.5 && performance.now() - startedAt > 1400) openLoader();
    else requestAnimationFrame(tick);
  })();
}

/* ---------- Custom cursor: dot follows instantly, ring trails behind ---------- */
if (!reduceMotion && finePointer) {
  const dot = $(".cursor-dot");
  const ring = $(".cursor-ring");
  let x = 0, y = 0, rx = 0, ry = 0;

  addEventListener("pointermove", (e) => {
    x = e.clientX;
    y = e.clientY;
    document.body.classList.add("has-cursor");
  });
  document.addEventListener("pointerover", (e) => ring.classList.toggle("hover", !!e.target.closest("a, button")));

  (function follow() {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(follow);
  })();
}
