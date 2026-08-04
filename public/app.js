// Dark mode toggle
const darkModeToggle = document.getElementById('dark-mode-toggle');

// Check for saved dark mode preference or system preference
const darkModePreference = localStorage.getItem('darkMode');
let isDarkMode;

if (darkModePreference !== null) {
  isDarkMode = darkModePreference === 'true';
} else {
  isDarkMode = true;
}

// Apply initial theme
function applyTheme(dark) {
  if (dark) {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    darkModeToggle.textContent = '☀️';
  } else {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode');
    darkModeToggle.textContent = '🌙';
  }
}

applyTheme(isDarkMode);

darkModeToggle.addEventListener('click', () => {
  isDarkMode = !isDarkMode;
  applyTheme(isDarkMode);
  localStorage.setItem('darkMode', isDarkMode);
});

// Background music toggle
(function () {
  const btn = document.getElementById('music-toggle');
  const audio = document.getElementById('bg-audio');
  const icon = btn ? btn.querySelector('.music-icon') : null;
  if (!btn || !audio) return;

  audio.volume = 0.35;
  let userPaused = localStorage.getItem('bgMusicPlaying') !== 'true';

  function setPlaying(playing) {
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', String(playing));
    btn.title = playing ? 'Pause background music' : 'Play background music';
    if (icon) icon.textContent = playing ? '🎵' : '🎧';
  }

  btn.addEventListener('click', async () => {
    if (audio.paused) {
      try {
        await audio.play();
        userPaused = false;
        setPlaying(true);
        localStorage.setItem('bgMusicPlaying', 'true');
      } catch (err) {
        btn.title = 'No track found at /audio/ambient.mp3';
        console.warn('Background music unavailable:', err.message);
      }
    } else {
      audio.pause();
      userPaused = true;
      setPlaying(false);
      localStorage.setItem('bgMusicPlaying', 'false');
    }
  });

  if (!userPaused) {
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }
})();

// Hero: typewriter tagline
(function () {
  const el = document.getElementById('hero-typed');
  if (!el) return;

  const lines = [
    'ML Research Engineer — Speech & Audio',
    'building streaming STT/TTS infrastructure',
    'speaker diarization · language ID · document intelligence'
  ];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    el.textContent = lines[0];
    return;
  }

  let lineIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function tick() {
    const current = lines[lineIndex];
    charIndex += deleting ? -1 : 1;
    el.innerHTML = current.slice(0, charIndex) + '<span class="cursor"></span>';

    let delay = deleting ? 30 : 55;

    if (!deleting && charIndex === current.length) {
      delay = 1600;
      deleting = true;
    } else if (deleting && charIndex === 0) {
      deleting = false;
      lineIndex = (lineIndex + 1) % lines.length;
      delay = 300;
    }

    setTimeout(tick, delay);
  }

  tick();
})();

// Hero: waveform canvas
(function () {
  const canvas = document.getElementById('hero-wave');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
  }

  function accentColor() {
    return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#2dd4bf';
  }

  let t = 0;
  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = accentColor();
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.lineCap = 'round';

    const bars = Math.floor(w / (6 * devicePixelRatio));
    const gap = w / bars;

    for (let i = 0; i < bars; i++) {
      const amp =
        Math.sin(i * 0.35 + t) * 0.35 +
        Math.sin(i * 0.12 - t * 1.7) * 0.4 +
        0.5;
      const barH = Math.max(4, amp * h * 0.85);
      const x = i * gap + gap / 2;
      ctx.globalAlpha = 0.35 + amp * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, h / 2 - barH / 2);
      ctx.lineTo(x, h / 2 + barH / 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  resize();
  window.addEventListener('resize', resize);

  if (reduceMotion) {
    draw();
    return;
  }

  function animate() {
    t += 0.045;
    draw();
    requestAnimationFrame(animate);
  }
  animate();
})();

// Mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Scroll-reveal animations
(function () {
  const targets = document.querySelectorAll(
    '.intro-card, .expertise-item, .about-journey, ' +
    '.timeline-item, .skill-group, .publication-item, .year-section, .related-item'
  );
  if (!targets.length) return;

  targets.forEach(el => el.classList.add('reveal'));

  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach(el => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => observer.observe(el));
})();

// Search functionality
const searchBox = document.getElementById('search-box');
const searchResults = document.getElementById('search-results');
let searchTimeout;

searchBox.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();

  if (query.length < 2) {
    searchResults.classList.add('hidden');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();

      if (results.length === 0) {
        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; opacity: 0.7;">No results found</div>';
      } else {
        searchResults.innerHTML = results.map(post => `
          <a href="/post/${post.slug}" class="search-result-item" style="display: block; text-decoration: none; color: inherit;">
            <h4>${escapeHtml(post.title)}</h4>
            <small>${post.date} · ${post.tags.join(', ')}</small>
          </a>
        `).join('');
      }

      searchResults.classList.remove('hidden');
    } catch (error) {
      console.error('Search error:', error);
    }
  }, 300);
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  if (e.target !== searchBox && !searchResults.contains(e.target)) {
    searchResults.classList.add('hidden');
  }
});

// Keyboard navigation in search results
searchBox.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchResults.classList.add('hidden');
  }
});

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Image lightbox with zoom for post content images
(function () {
  const images = document.querySelectorAll('.post-content img');
  if (!images.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay hidden';
  overlay.innerHTML = `
    <div class="lightbox-toolbar">
      <button type="button" class="lightbox-btn" data-action="zoom-out" aria-label="Zoom out">−</button>
      <button type="button" class="lightbox-btn" data-action="zoom-reset" aria-label="Reset zoom">⤢</button>
      <button type="button" class="lightbox-btn" data-action="zoom-in" aria-label="Zoom in">+</button>
      <button type="button" class="lightbox-btn lightbox-close" data-action="close" aria-label="Close">✕</button>
    </div>
    <div class="lightbox-stage">
      <img class="lightbox-img" src="" alt="" />
    </div>
  `;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector('.lightbox-stage');
  const lightboxImg = overlay.querySelector('.lightbox-img');
  let scale = 1;
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 4;

  function setScale(newScale) {
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    lightboxImg.style.transform = `scale(${scale})`;
  }

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    setScale(1);
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    overlay.classList.add('hidden');
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  images.forEach(img => {
    img.classList.add('zoomable-img');
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
  });

  overlay.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'zoom-in') setScale(scale + 0.25);
    else if (action === 'zoom-out') setScale(scale - 0.25);
    else if (action === 'zoom-reset') setScale(1);
    else if (action === 'close' || e.target === overlay || e.target === stage) closeLightbox();
  });

  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    setScale(scale + (e.deltaY < 0 ? 0.15 : -0.15));
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === '+' || e.key === '=') setScale(scale + 0.25);
    else if (e.key === '-') setScale(scale - 0.25);
    else if (e.key === '0') setScale(1);
  });
})();

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href !== '#') {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});
