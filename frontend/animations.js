// Shared entrance animations for the landing page.
// Safe to include anywhere — it no-ops if the relevant elements aren't present.

document.addEventListener("DOMContentLoaded", () => {
  setupScrollReveal();
  setupCounters();
  setupAccordion();
  setupFeatureTabs();
  setupHeroNetwork();
  setupSpotlight();
  setupMagneticButtons();
  setupHeroParallax();
  setupRipple();
  setupCustomCursor();
  setupScrambleText();
  setupGhostHeadings();
  setupBackToTop();
});

function setupScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("in-view"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  els.forEach((el) => io.observe(el));
}

function setupCounters() {
  const els = document.querySelectorAll("[data-count-to]");
  if (!els.length) return;

  const run = (el) => {
    const target = parseFloat(el.dataset.countTo);
    const suffix = el.dataset.suffix || "";
    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  if (!("IntersectionObserver" in window)) {
    els.forEach(run);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  els.forEach((el) => io.observe(el));
}

function setupAccordion() {
  const accordion = document.getElementById("accordion");
  if (!accordion) return;

  const rows = accordion.querySelectorAll(".acc-row");
  rows.forEach((row) => {
    const head = row.querySelector(".acc-head");
    head.addEventListener("click", () => {
      const wasOpen = row.classList.contains("open");
      rows.forEach((r) => r.classList.remove("open"));
      if (!wasOpen) row.classList.add("open");
    });
  });
}

// Particle "constellation" network for the hero background — inspired by
// the clustered node graphics on allzonetech.com. A handful of cluster
// centers each hold a small swarm of particles that drift and connect to
// their neighbors; cluster centers connect to each other with long, faint
// lines. The whole field also reacts to the cursor: particles within range
// are gently pushed away, so moving your mouse through it visibly disturbs
// the network.
function setupHeroNetwork() {
  const canvas = document.getElementById("hero-network");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let width, height, clusters, mouse = { x: -9999, y: -9999, active: false };
  const CLUSTER_COUNT = 5;
  const PARTICLES_PER_CLUSTER = 14;
  const CLUSTER_RADIUS = 55;
  const MOUSE_RADIUS = 90;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = canvas.width = rect.width;
    height = canvas.height = rect.height;

    // Cluster centers live in the right ~60% of the hero, roughly where the
    // report card sits, arranged in a loose ring so lines cross nicely.
    const cx = width * 0.78;
    const cy = height * 0.5;
    const ringRadius = Math.min(width * 0.16, 140);

    clusters = Array.from({ length: CLUSTER_COUNT }, (_, i) => {
      const angle = (i / CLUSTER_COUNT) * Math.PI * 2;
      const centerX = cx + Math.cos(angle) * ringRadius;
      const centerY = cy + Math.sin(angle) * ringRadius * 0.6;
      return {
        cx: centerX,
        cy: centerY,
        particles: Array.from({ length: PARTICLES_PER_CLUSTER }, () => {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * CLUSTER_RADIUS;
          return {
            baseX: Math.cos(a) * r,
            baseY: Math.sin(a) * r,
            x: centerX + Math.cos(a) * r,
            y: centerY + Math.sin(a) * r,
            phase: Math.random() * Math.PI * 2,
            accent: Math.random() < 0.15,
          };
        }),
      };
    });
  }

  function handleMouse(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  }

  let t = 0;

  function step() {
    t += 0.015;
    ctx.clearRect(0, 0, width, height);
    const fadeStart = width * 0.3;

    // Update particle positions: gentle orbit around cluster center, plus
    // a push away from the cursor when it's nearby.
    clusters.forEach((cluster) => {
      cluster.particles.forEach((p) => {
        const wobbleX = Math.sin(t + p.phase) * 4;
        const wobbleY = Math.cos(t + p.phase) * 4;
        let targetX = cluster.cx + p.baseX + wobbleX;
        let targetY = cluster.cy + p.baseY + wobbleY;

        if (mouse.active) {
          const dx = targetX - mouse.x;
          const dy = targetY - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS) {
            const force = (1 - dist / MOUSE_RADIUS) * 26;
            const angle = Math.atan2(dy, dx);
            targetX += Math.cos(angle) * force;
            targetY += Math.sin(angle) * force;
          }
        }

        p.x += (targetX - p.x) * 0.12;
        p.y += (targetY - p.y) * 0.12;
      });
    });

    // Lines between cluster centers (the "galaxy web").
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i];
        const b = clusters[j];
        const midX = (a.cx + b.cx) / 2;
        const edgeFade = Math.max(0, Math.min(1, (midX - fadeStart) / (width - fadeStart)));
        if (edgeFade <= 0) continue;
        ctx.strokeStyle = `rgba(18, 20, 28, ${0.06 * edgeFade})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.cx, a.cy);
        ctx.lineTo(b.cx, b.cy);
        ctx.stroke();
      }
    }

    // Lines within each cluster + the particles themselves.
    clusters.forEach((cluster) => {
      const pts = cluster.particles;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 45) {
            const midX = (pts[i].x + pts[j].x) / 2;
            const edgeFade = Math.max(0, Math.min(1, (midX - fadeStart) / (width - fadeStart)));
            const alpha = (1 - dist / 45) * 0.3 * edgeFade;
            if (alpha <= 0) continue;
            ctx.strokeStyle = `rgba(18, 20, 28, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      pts.forEach((p) => {
        const edgeFade = Math.max(0, Math.min(1, (p.x - fadeStart) / (width - fadeStart)));
        if (edgeFade <= 0) return;
        ctx.fillStyle = p.accent
          ? `rgba(59, 76, 255, ${0.6 * edgeFade})`
          : `rgba(18, 20, 28, ${0.4 * edgeFade})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.accent ? 2.2 : 1.6, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    if (!prefersReducedMotion) requestAnimationFrame(step);
  }

  resize();
  window.addEventListener("resize", resize);
  canvas.parentElement.addEventListener("mousemove", handleMouse);
  canvas.parentElement.addEventListener("mouseleave", () => (mouse.active = false));
  step();
}

// Soft radial glow that follows the cursor within the hero — a cheap but
// effective "spotlight" effect (just a positioned CSS gradient, moved via
// custom properties on mousemove).
function setupSpotlight() {
  const hero = document.querySelector(".hero");
  const spotlight = document.getElementById("hero-spotlight");
  if (!hero || !spotlight) return;

  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    spotlight.style.setProperty("--x", `${x}%`);
    spotlight.style.setProperty("--y", `${y}%`);
  });
}

// Magnetic buttons: the button (and its inner label, at a different rate)
// nudges toward the cursor while hovered, and springs back on leave.
function setupMagneticButtons() {
  const buttons = document.querySelectorAll(".magnetic");
  if (!buttons.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(hover: none)").matches) return; // skip on touch devices

  buttons.forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const relX = e.clientX - rect.left - rect.width / 2;
      const relY = e.clientY - rect.top - rect.height / 2;
      btn.style.setProperty("--mx", `${relX * 0.25}px`);
      btn.style.setProperty("--my", `${relY * 0.25}px`);
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.setProperty("--mx", "0px");
      btn.style.setProperty("--my", "0px");
    });
  });
}

// As the hero scrolls out of view, fade and lift the network canvas and
// the report-card visual — a lightweight scroll-linked parallax.
function setupHeroParallax() {
  const hero = document.querySelector(".hero");
  const canvas = document.getElementById("hero-network");
  const visual = document.getElementById("hero-visual");
  if (!hero || !canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;

  // The hero-visual has its own one-time entrance animation (fadeUp) that
  // also sets `transform`. Clear it once it's done so our scroll-driven
  // transform below isn't fighting a still-active CSS animation.
  if (visual) {
    setTimeout(() => {
      visual.style.animation = "none";
      update();
    }, 1000);
  }

  function update() {
    const rect = hero.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -rect.top / rect.height));
    canvas.style.opacity = String(1 - progress);
    canvas.style.transform = `translateY(${progress * 40}px)`;
    if (visual) visual.style.transform = `translateY(${progress * 24}px)`;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}

// Interactive tab panel — click a tab, its content crossfades in on the
// right and a sliding indicator moves behind the active tab label
// (the "Domain knowledge changes the product" pattern).
function setupFeatureTabs() {
  const list = document.getElementById("feature-tabs");
  const indicator = document.getElementById("tab-indicator");
  const content = document.getElementById("tab-content");
  if (!list || !indicator || !content) return;

  const tabs = list.querySelectorAll(".tab-item");
  const panes = content.querySelectorAll(".tab-pane");

  function moveIndicator(tab) {
    indicator.style.height = `${tab.offsetHeight}px`;
    indicator.style.transform = `translateY(${tab.offsetTop}px)`;
  }

  function activate(index) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === String(index)));
    panes.forEach((p) => p.classList.toggle("active", p.dataset.pane === String(index)));
    moveIndicator(tabs[index]);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => activate(i));
  });

  // Position the indicator behind tab 0 once layout has settled.
  requestAnimationFrame(() => moveIndicator(tabs[0]));
  window.addEventListener("resize", () => {
    const activeIndex = [...tabs].findIndex((t) => t.classList.contains("active"));
    moveIndicator(tabs[activeIndex >= 0 ? activeIndex : 0]);
  });
}

// Click ripple: spawns a small circle at the click point inside any
// .ripple button/link and lets it expand + fade via CSS, then removes it.
function setupRipple() {
  const buttons = document.querySelectorAll(".ripple");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.6;
      const circle = document.createElement("span");
      circle.className = "ripple-circle";
      circle.style.width = circle.style.height = `${size}px`;
      circle.style.left = `${e.clientX - rect.left - size / 2}px`;
      circle.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(circle);
      circle.addEventListener("animationend", () => circle.remove());
    });
  });
}

// Custom cursor: a small ring that follows the mouse with a slight lag,
// and grows when hovering anything clickable. Desktop-only — skipped on
// touch devices and when the user has asked for reduced motion.
function setupCustomCursor() {
  if (window.matchMedia("(hover: none)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  document.body.appendChild(ring);
  document.documentElement.classList.add("custom-cursor-active");

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    ring.style.opacity = "1";
  });

  document.addEventListener("mouseleave", () => (ring.style.opacity = "0"));

  const hoverTargets = "a, button, .btn, .tab-item, .acc-head, input, textarea, .dropzone";
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(hoverTargets)) ring.classList.add("cursor-ring--active");
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(hoverTargets)) ring.classList.remove("cursor-ring--active");
  });

  function tick() {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
    requestAnimationFrame(tick);
  }
  tick();
}

// Scramble/decode text reveal: swaps each character through random
// glyphs before settling on the real letter, left to right. Applied to
// the hero headline on load, and exposed on window so app.js can trigger
// it on dynamic report titles too.
function scrambleText(el, finalText, duration = 600) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const start = performance.now();
  const length = finalText.length;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const revealCount = Math.floor(progress * length);
    let out = "";
    for (let i = 0; i < length; i++) {
      if (i < revealCount) {
        out += finalText[i];
      } else if (finalText[i] === " ") {
        out += " ";
      } else {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    el.textContent = out;
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = finalText;
  }
  requestAnimationFrame(tick);
}
window.scrambleText = scrambleText;

function setupScrambleText() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Hero headline words (index.html) — decode in, staggered per word,
  // replacing the plain fadeUp for this element only.
  const words = document.querySelectorAll(".hero h1 .word");
  words.forEach((word, i) => {
    if (word.children.length > 0) return; // skip words with nested tags (e.g. <em>)
    const original = word.textContent;
    setTimeout(() => scrambleText(word, original, 500), i * 90 + 100);
  });

  // Static headings on app.html get a quick decode-in on load too.
  document.querySelectorAll("[data-scramble]").forEach((el) => {
    scrambleText(el, el.textContent, 500);
  });
}

// Ghost-flash headings: when a section heading scrolls into view, a
// faint, oversized duplicate of its own text flashes behind it and
// fades out — the "watermark" effect from the reference video.
function setupGhostHeadings() {
  const heads = document.querySelectorAll(".section-head h2");
  if (!heads.length) return;

  heads.forEach((h2) => {
    h2.style.position = "relative";
    const ghost = document.createElement("span");
    ghost.className = "ghost-text";
    ghost.textContent = h2.textContent;
    ghost.setAttribute("aria-hidden", "true");
    h2.appendChild(ghost);
  });

  if (!("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelector(".ghost-text")?.classList.add("flash");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  heads.forEach((h2) => io.observe(h2));
}

function setupBackToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
