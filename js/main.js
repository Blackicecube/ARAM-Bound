/* ============================================================
   ARAM BOUND — main.js
   Handles: navbar scroll, hamburger menu, scroll-reveal,
            animated counters, progress bars, upvote buttons,
            and particle canvas animation
   ============================================================ */

'use strict';

// ── Wait for the DOM to be ready ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initHamburger();
  initScrollReveal();
  initCounters();
  initProgressBars();
  initUpvoteButtons();
  initParticles();
});


/* ============================================================
   1. NAVBAR — adds "scrolled" class on scroll for glass effect
   ============================================================ */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  // On inner pages (no full-height hero), always keep scrolled style
  const hasHero = document.getElementById('hero');

  function handleScroll() {
    if (!hasHero || window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Run once on load
}


/* ============================================================
   2. HAMBURGER MENU — mobile nav toggle
   ============================================================ */
function initHamburger() {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close the menu when a nav link is clicked (mobile UX)
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', false);
    });
  });
}


/* ============================================================
   3. SCROLL REVEAL — animates elements into view using
      IntersectionObserver. Add class "reveal" to any element
      you want to fade+slide in when it enters the viewport.
   ============================================================ */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Stagger each sibling element by 100ms
          const siblings = Array.from(
            entry.target.parentElement.querySelectorAll('.reveal')
          );
          const delay = siblings.indexOf(entry.target) * 80;

          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);

          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,    // Trigger when 10% of the element is visible
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elements.forEach(el => observer.observe(el));
}


/* ============================================================
   4. ANIMATED COUNTERS — counts up to the data-target number
      when the stats bar scrolls into view
   ============================================================ */
function initCounters() {
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  if (!statNumbers.length) return;

  let hasRun = false;

  function animateCounter(el) {
    const target   = parseInt(el.getAttribute('data-target'), 10);
    const duration = 1600; // ms
    const start    = performance.now();

    function update(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = Math.round(eased * target);

      el.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toLocaleString();
      }
    }

    requestAnimationFrame(update);
  }

  const statsContainer = document.getElementById('hero-stats');
  if (!statsContainer) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasRun) {
          hasRun = true;
          statNumbers.forEach(el => animateCounter(el));
          observer.disconnect();
        }
      });
    },
    { threshold: 0.5 }
  );

  observer.observe(statsContainer);
}


/* ============================================================
   5. PROGRESS BARS — animate width into place on scroll
   ============================================================ */
function initProgressBars() {
  const bars = document.querySelectorAll('.progress-fill[data-width]');
  if (!bars.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const targetWidth = bar.getAttribute('data-width') + '%';
          // Small delay so the CSS transition is visible
          setTimeout(() => {
            bar.style.width = targetWidth;
          }, 200);
          observer.unobserve(bar);
        }
      });
    },
    { threshold: 0.3 }
  );

  bars.forEach(bar => observer.observe(bar));
}


/* ============================================================
   6. UPVOTE BUTTONS — toggle voted state and update count
   ============================================================ */
function initUpvoteButtons() {
  const buttons = document.querySelectorAll('.upvote-btn');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id       = btn.getAttribute('data-id');
      const countEl  = document.getElementById('vote-count-' + id);
      if (!countEl) return;

      const isVoted  = btn.classList.toggle('voted');
      const current  = parseInt(countEl.textContent.replace(',', ''), 10);

      if (isVoted) {
        countEl.textContent = (current + 1).toLocaleString();
        // Brief pop animation
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => { btn.style.transform = ''; }, 200);
      } else {
        countEl.textContent = (current - 1).toLocaleString();
      }
    });
  });
}


/* ============================================================
   7. PARTICLE CANVAS — subtle floating ice particle effect
      Draws small glowing dots that drift upward, evoking
      the Howling Abyss snowfall feel
   ============================================================ */
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let particles  = [];
  let animFrameId;

  // Particle settings
  const PARTICLE_COUNT = 60;
  const COLORS = [
    'rgba(79, 195, 247, 0.7)',   // ice blue
    'rgba(200, 155, 60, 0.5)',   // gold
    'rgba(255, 255, 255, 0.4)',  // white
    'rgba(139, 108, 240, 0.4)',  // purple
  ];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x:       Math.random() * canvas.width,
      y:       canvas.height + Math.random() * 100,
      radius:  Math.random() * 2 + 0.5,
      color:   COLORS[Math.floor(Math.random() * COLORS.length)],
      speedY:  -(Math.random() * 0.6 + 0.2),   // drifts upward
      speedX:  (Math.random() - 0.5) * 0.3,    // slight horizontal drift
      opacity: Math.random() * 0.6 + 0.2,
    };
  }

  function initParticleList() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = createParticle();
      // Start at a random vertical position (not just at the bottom)
      p.y = Math.random() * canvas.height;
      particles.push(p);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;

      // Soft glow effect
      ctx.shadowBlur   = 8;
      ctx.shadowColor  = p.color;

      ctx.fill();
      ctx.closePath();

      // Reset shadow for performance
      ctx.shadowBlur = 0;

      // Move particle
      p.x += p.speedX;
      p.y += p.speedY;

      // Reset when particle goes above the canvas
      if (p.y < -10) {
        Object.assign(p, createParticle());
      }
    });

    ctx.globalAlpha = 1;
    animFrameId = requestAnimationFrame(draw);
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    resize();
    initParticleList();
  }, { passive: true });

  // Init and start
  resize();
  initParticleList();
  draw();

  // Pause animation when tab is hidden (performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animFrameId);
    } else {
      draw();
    }
  });
}
