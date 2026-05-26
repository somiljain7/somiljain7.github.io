// Dark mode toggle
const darkModeToggle = document.getElementById('dark-mode-toggle');

// Check for saved dark mode preference or system preference
const darkModePreference = localStorage.getItem('darkMode');
let isDarkMode;

if (darkModePreference !== null) {
  isDarkMode = darkModePreference === 'true';
} else {
  isDarkMode = !window.matchMedia('(prefers-color-scheme: light)').matches;
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
