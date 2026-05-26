import express from 'express';
import compression from 'compression';
import expressLayouts from 'express-ejs-layouts';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';
import { marked } from 'marked';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// Cache for blog posts (reduces file I/O)
let postsCache = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Load blog posts
function loadPosts() {
  const now = Date.now();
  if (postsCache && (now - cacheTime) < CACHE_DURATION) {
    return postsCache;
  }

  const postsDir = path.join(__dirname, '_posts');
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  
  const posts = files.map(file => {
    const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
    const { data, content: body } = matter(content);
    const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
    
    return {
      slug,
      title: data.title || file,
      date: new Date(data.date),
      categories: data.categories || [],
      tags: data.tags || [],
      excerpt: data.excerpt || body.substring(0, 150),
      content: marked(body)
    };
  }).sort((a, b) => b.date - a.date);

  postsCache = posts;
  cacheTime = now;
  return posts;
}

// Routes
app.get('/', (req, res) => {
  const posts = loadPosts();
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const total = posts.length;
  const pages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const paginatedPosts = posts.slice(start, start + perPage);

  res.render('index', { posts: paginatedPosts, page, pages, total });
});

app.get('/post/:slug', (req, res) => {
  const posts = loadPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  
  if (!post) {
    return res.status(404).render('404');
  }

  // Get related posts by tags
  const related = posts
    .filter(p => p.slug !== post.slug && p.tags.some(t => post.tags.includes(t)))
    .slice(0, 3);

  res.render('post', { post, related });
});

app.get('/category/:category', (req, res) => {
  const posts = loadPosts();
  const filtered = posts.filter(p => 
    p.categories.some(c => c.toLowerCase() === req.params.category.toLowerCase())
  );

  res.render('category', { 
    category: req.params.category, 
    posts: filtered,
    count: filtered.length 
  });
});

app.get('/tag/:tag', (req, res) => {
  const posts = loadPosts();
  const filtered = posts.filter(p => 
    p.tags.some(t => t.toLowerCase() === req.params.tag.toLowerCase())
  );

  res.render('tag', { 
    tag: req.params.tag, 
    posts: filtered,
    count: filtered.length 
  });
});

app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  if (query.length < 2) {
    return res.json([]);
  }

  const posts = loadPosts();
  const results = posts.filter(p => 
    p.title.toLowerCase().includes(query) ||
    p.excerpt.toLowerCase().includes(query) ||
    p.tags.some(t => t.toLowerCase().includes(query))
  ).slice(0, 10);

  res.json(results);
});

app.get('/sitemap', (req, res) => {
  const posts = loadPosts();
  res.type('application/xml');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += '<url><loc>https://somiljain7.github.io/</loc></url>\n';
  
  posts.forEach(post => {
    xml += `<url><loc>https://somiljain7.github.io/post/${post.slug}</loc></url>\n`;
  });
  
  xml += '</urlset>';
  res.send(xml);
});

app.get('/feed', (req, res) => {
  const posts = loadPosts().slice(0, 20);
  res.type('application/xml');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0"><channel>\n';
  xml += '<title>CODERATWORK7</title>\n';
  xml += '<link>https://somiljain7.github.io</link>\n';
  xml += '<description>Personal blog by Somil Jain</description>\n';
  
  posts.forEach(post => {
    xml += `<item>
      <title>${post.title}</title>
      <link>https://somiljain7.github.io/post/${post.slug}</link>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <description>${post.excerpt}</description>
    </item>\n`;
  });
  
  xml += '</channel></rss>';
  res.send(xml);
});

app.get('/archives', (req, res) => {
  const posts = loadPosts();
  const grouped = {};
  
  posts.forEach(post => {
    const year = post.date.getFullYear();
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(post);
  });

  res.render('archives', { grouped });
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/cv', (req, res) => {
  res.render('cv');
});

app.get('/publications', (req, res) => {
  // Load publications from _publications folder
  const pubDir = path.join(__dirname, '_publications');
  const files = fs.readdirSync(pubDir).filter(f => f.endsWith('.md'));
  
  const publications = files.map(file => {
    const content = fs.readFileSync(path.join(pubDir, file), 'utf-8');
    const { data } = matter(content);
    
    return {
      title: data.title || file,
      date: new Date(data.date),
      venue: data.venue || 'Unknown Venue',
      paperurl: data.paperurl || '#',
      citation: data.citation || ''
    };
  }).sort((a, b) => b.date - a.date);

  res.render('publications', { publications });
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`🚀 Blog running at http://localhost:${PORT}`);
  console.log(`📝 Loaded ${loadPosts().length} posts`);
});
