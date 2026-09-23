import express from 'express';
import compression from 'compression';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import matter from 'gray-matter';
import { marked } from 'marked';
import 'dotenv/config';

import {
  getDb,
  syncLocalPostsToMongo,
  getMongoPosts,
  getMongoPostBySlug,
  saveMongoPost,
  deleteMongoPost
} from './lib/db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve root directory across local and Vercel serverless environments
const BASE_DIR = fs.existsSync(path.join(process.cwd(), 'views')) ? process.cwd() : __dirname;
const POSTS_DIR = path.join(BASE_DIR, '_posts');
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const PUBLICATIONS_DIR = path.join(BASE_DIR, '_publications');
const VIEWS_DIR = path.join(BASE_DIR, 'views');
const TMP_UPLOADS_DIR = path.join('/tmp', 'uploads');
const TMP_POSTS_DIR = path.join('/tmp', '_posts');

// Configuration & Secrets
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'diarypassword123';
const API_KEY = process.env.API_KEY || 'diary_secret_token_2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'diary_session_secret_default';
const SITE_TITLE = process.env.SITE_TITLE || '[ CODERATWORK7 ]';
const SITE_SUBTITLE = process.env.SITE_SUBTITLE || 'ML Research Engineer & Neural Logs';
const SITE_AUTHOR = process.env.SITE_AUTHOR || 'CODERATWORK7';

// Ensure directories exist (wrapped in try/catch for read-only serverless runtimes)
[POSTS_DIR, UPLOADS_DIR, PUBLICATIONS_DIR, TMP_UPLOADS_DIR, TMP_POSTS_DIR].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Ignore in read-only environments
  }
});

// Multer storage for image uploads with /tmp fallback
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = UPLOADS_DIR;
    try {
      fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
    } catch (e) {
      dest = TMP_UPLOADS_DIR;
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const timestamp = Date.now();
    cb(null, `${timestamp}-${safeBase}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg|mp3|wav|ogg|pdf|txt|zip/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const mime = file.mimetype;
    if (allowed.test(ext) || allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Supported: images, audio, pdf, zip.'));
    }
  }
});

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true
});

// Middleware
app.use(compression());
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/uploads', express.static(TMP_UPLOADS_DIR));
app.use(express.text({ type: ['text/plain', 'text/markdown'], limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Explicit static handlers for Vercel
app.get('/style.css', (req, res) => {
  const filePath = path.join(PUBLIC_DIR, 'style.css');
  if (fs.existsSync(filePath)) {
    res.type('text/css').sendFile(filePath);
  } else {
    res.type('text/css').send('/* CSS fallback */');
  }
});

app.get('/app.js', (req, res) => {
  const filePath = path.join(PUBLIC_DIR, 'app.js');
  if (fs.existsSync(filePath)) {
    res.type('application/javascript').sendFile(filePath);
  } else {
    res.type('application/javascript').send('/* JS fallback */');
  }
});

// Resilient JSON parser that auto-sanitizes unescaped newlines/tabs in string literals
app.use((req, res, next) => {
  if (req.is('application/json') || (req.headers['content-type'] && req.headers['content-type'].includes('json'))) {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw || !raw.trim()) {
        req.body = {};
        return next();
      }
      try {
        req.body = JSON.parse(raw);
        next();
      } catch (err) {
        try {
          let inString = false;
          let escaped = false;
          let sanitized = '';
          for (let i = 0; i < raw.length; i++) {
            const char = raw[i];
            if (char === '"' && !escaped) {
              inString = !inString;
              sanitized += char;
            } else if (inString && char === '\n') {
              sanitized += '\\n';
            } else if (inString && char === '\r') {
              sanitized += '\\r';
            } else if (inString && char === '\t') {
              sanitized += '\\t';
            } else {
              sanitized += char;
            }
            escaped = (char === '\\' && !escaped);
          }
          req.body = JSON.parse(sanitized);
          next();
        } catch (err2) {
          return res.status(400).json({ error: 'Invalid JSON', details: err.message });
        }
      }
    });
  } else {
    next();
  }
});

app.use(cookieParser(SESSION_SECRET));
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);
app.set('layout', 'layout');

// Rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Helper: Generate auth token
function generateAuthToken() {
  return crypto.createHmac('sha256', SESSION_SECRET).update(ADMIN_PASSWORD).digest('hex');
}

// Helper: Check authentication
function checkAuth(req) {
  const token = generateAuthToken();
  if (req.cookies && req.cookies.diary_auth === token) return true;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer === API_KEY || bearer === ADMIN_PASSWORD) return true;
  }

  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && (apiKeyHeader === API_KEY || apiKeyHeader === ADMIN_PASSWORD)) return true;

  if (req.query && (req.query.api_key === API_KEY || req.query.api_key === ADMIN_PASSWORD)) return true;

  return false;
}

function requireWebAuth(req, res, next) {
  if (checkAuth(req)) return next();
  const returnTo = encodeURIComponent(req.originalUrl || '/admin');
  return res.redirect(`/login?next=${returnTo}`);
}

function requireApiAuth(req, res, next) {
  if (checkAuth(req)) return next();
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Provide valid Authorization: Bearer <API_KEY> or X-API-Key header.'
  });
}

// Template Variables
app.use((req, res, next) => {
  res.locals.isAuthenticated = checkAuth(req);
  res.locals.siteTitle = SITE_TITLE;
  res.locals.siteSubtitle = SITE_SUBTITLE;
  res.locals.siteAuthor = SITE_AUTHOR;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  next();
});

// Cache & Sync on boot
let initialSynced = false;
async function ensureDbSynced() {
  if (!initialSynced && process.env.MONGODB_URI) {
    initialSynced = true;
    syncLocalPostsToMongo(POSTS_DIR).catch(e => console.warn('Background Mongo sync:', e.message));
  }
}
ensureDbSynced();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function calculateReadingTime(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return { minutes, words };
}

// Load posts from MongoDB or local fallback
async function loadPosts(options = { includeAll: false }) {
  await ensureDbSynced();

  // Try MongoDB Atlas first
  if (process.env.MONGODB_URI) {
    const mongoPosts = await getMongoPosts(options);
    if (mongoPosts && mongoPosts.length > 0) {
      return mongoPosts;
    }
  }

  // Local filesystem fallback
  const allFilesMap = new Map();
  if (fs.existsSync(POSTS_DIR)) {
    try {
      fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).forEach(f => {
        allFilesMap.set(f, path.join(POSTS_DIR, f));
      });
    } catch (e) {}
  }
  if (fs.existsSync(TMP_POSTS_DIR)) {
    try {
      fs.readdirSync(TMP_POSTS_DIR).filter(f => f.endsWith('.md')).forEach(f => {
        allFilesMap.set(f, path.join(TMP_POSTS_DIR, f));
      });
    } catch (e) {}
  }

  const posts = [];
  for (const [file, fullPath] of allFilesMap.entries()) {
    try {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const { data, content: body } = matter(fileContent);
      
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      const postDate = data.date ? new Date(data.date) : (dateMatch ? new Date(dateMatch[1]) : new Date());
      const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
      
      const categories = Array.isArray(data.categories) 
        ? data.categories 
        : (data.categories ? [data.categories] : (data.category ? [data.category] : ['Engineering']));
        
      const tags = Array.isArray(data.tags) 
        ? data.tags 
        : (typeof data.tags === 'string' ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []);

      const stats = calculateReadingTime(body);
      const excerpt = data.excerpt || body.replace(/[#*`_~\[\]]/g, '').trim().substring(0, 160) + '...';
      const visibility = data.visibility || (data.private ? 'private' : 'public');

      posts.push({
        filename: file,
        slug,
        title: data.title || slug.replace(/-/g, ' '),
        date: postDate,
        categories,
        tags,
        mood: data.mood || null,
        visibility,
        pinned: Boolean(data.pinned),
        excerpt,
        wordCount: stats.words,
        readingTime: stats.minutes,
        rawContent: body,
        content: marked(body)
      });
    } catch (err) {
      console.error(`Error loading post ${file}:`, err.message);
    }
  }

  const sorted = posts.sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    return b.date - a.date;
  });

  if (options.includeAll) return sorted;
  return sorted.filter(p => p.visibility === 'public');
}

// Single post lookup
async function loadSinglePost(slug) {
  if (process.env.MONGODB_URI) {
    const post = await getMongoPostBySlug(slug);
    if (post) return post;
  }

  const all = await loadPosts({ includeAll: true });
  return all.find(p => p.slug === slug);
}

// Calculate Streak and Stats
function getDiaryStats(posts) {
  const dateCounts = {};
  let totalWords = 0;
  const moodCounts = {};
  const categoryCounts = {};
  const tagCounts = {};

  posts.forEach(post => {
    totalWords += post.wordCount || 0;
    const dStr = post.date.toISOString().split('T')[0];
    dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;

    if (post.mood) moodCounts[post.mood] = (moodCounts[post.mood] || 0) + 1;

    post.categories.forEach(c => { categoryCounts[c] = (categoryCounts[c] || 0) + 1; });
    post.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  });

  let streak = 0;
  const today = new Date();
  let checkDate = new Date(today);
  const formatD = d => d.toISOString().split('T')[0];
  
  if (dateCounts[formatD(checkDate)]) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (dateCounts[formatD(checkDate)]) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    totalPosts: posts.length,
    totalWords,
    streak,
    dateCounts,
    moodCounts,
    categoryCounts,
    tagCounts
  };
}

// Save post helper (MongoDB + local fallback)
async function savePostFile({ originalFilename, slug, title, content, date, categories, tags, mood, visibility, excerpt, pinned }) {
  const d = date ? new Date(date) : new Date();
  const datePrefix = d.toISOString().split('T')[0];
  const finalSlug = slugify(slug || title || 'diary-entry');
  const filename = `${datePrefix}-${finalSlug}.md`;

  const frontmatter = {
    title: title || 'Untitled Entry',
    date: datePrefix,
    categories: Array.isArray(categories) ? categories : (categories ? categories.split(',').map(c => c.trim()).filter(Boolean) : ['Engineering']),
    tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
    mood: mood || null,
    visibility: visibility || 'public',
    excerpt: excerpt || '',
    pinned: Boolean(pinned)
  };

  // 1. Save to MongoDB Atlas (Persistent Cloud Storage)
  if (process.env.MONGODB_URI) {
    await saveMongoPost({
      slug: finalSlug,
      title: frontmatter.title,
      content: content || '',
      date: d,
      categories: frontmatter.categories,
      tags: frontmatter.tags,
      mood: frontmatter.mood,
      visibility: frontmatter.visibility,
      pinned: frontmatter.pinned,
      excerpt: frontmatter.excerpt
    });
  }

  // 2. Also try writing locally / to /tmp
  try {
    const fileData = matter.stringify(content || '', frontmatter);
    const filePath = path.join(POSTS_DIR, filename);
    if (originalFilename && originalFilename !== filename) {
      const oldPath = path.join(POSTS_DIR, originalFilename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    fs.writeFileSync(filePath, fileData, 'utf-8');
  } catch (err) {
    try {
      const fileData = matter.stringify(content || '', frontmatter);
      const tmpPath = path.join(TMP_POSTS_DIR, filename);
      fs.writeFileSync(tmpPath, fileData, 'utf-8');
    } catch (e) {}
  }

  return {
    filename,
    slug: finalSlug,
    title: frontmatter.title,
    url: `/post/${finalSlug}`
  };
}

// Delete post helper
async function deletePostFile(slug) {
  if (process.env.MONGODB_URI) {
    await deleteMongoPost(slug);
  }

  const all = await loadPosts({ includeAll: true });
  const post = all.find(p => p.slug === slug);
  if (post && post.filename) {
    try {
      const p1 = path.join(POSTS_DIR, post.filename);
      if (fs.existsSync(p1)) fs.unlinkSync(p1);
    } catch (e) {}
    try {
      const p2 = path.join(TMP_POSTS_DIR, post.filename);
      if (fs.existsSync(p2)) fs.unlinkSync(p2);
    } catch (e) {}
  }
  return true;
}

// ==========================================
// PUBLIC WEB ROUTES
// ==========================================

app.get('/', async (req, res) => {
  const isAuth = checkAuth(req);
  const posts = await loadPosts({ includeAll: isAuth });
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const total = posts.length;
  const pages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const paginatedPosts = posts.slice(start, start + perPage);
  const stats = getDiaryStats(posts);

  res.render('index', { 
    posts: paginatedPosts, 
    page, 
    pages, 
    total,
    stats,
    title: 'Journal & Engineering Logs'
  });
});

app.get('/post/:slug', async (req, res) => {
  const isAuth = checkAuth(req);
  const post = await loadSinglePost(req.params.slug);

  if (!post) {
    return res.status(404).render('404', { title: 'Entry Not Found' });
  }

  if (post.visibility === 'private' && !isAuth) {
    return res.status(403).render('404', { 
      title: 'Private Entry',
      message: 'This entry is private. Please authenticate to view.' 
    });
  }

  const visiblePosts = await loadPosts({ includeAll: isAuth });
  const related = visiblePosts
    .filter(p => p.slug !== post.slug && p.tags.some(t => post.tags.includes(t)))
    .slice(0, 3);

  res.render('post', { post, related, title: post.title });
});

app.get('/category/:category', async (req, res) => {
  const isAuth = checkAuth(req);
  const posts = await loadPosts({ includeAll: isAuth });
  const filtered = posts.filter(p => 
    p.categories.some(c => c.toLowerCase() === req.params.category.toLowerCase())
  );

  res.render('category', { 
    category: req.params.category, 
    posts: filtered,
    count: filtered.length,
    title: `Category: ${req.params.category}`
  });
});

app.get('/tag/:tag', async (req, res) => {
  const isAuth = checkAuth(req);
  const posts = await loadPosts({ includeAll: isAuth });
  const filtered = posts.filter(p => 
    p.tags.some(t => t.toLowerCase() === req.params.tag.toLowerCase())
  );

  res.render('tag', { 
    tag: req.params.tag, 
    posts: filtered,
    count: filtered.length,
    title: `Tag: #${req.params.tag}`
  });
});

app.get('/archives', async (req, res) => {
  const isAuth = checkAuth(req);
  const posts = await loadPosts({ includeAll: isAuth });
  const grouped = {};

  posts.forEach(post => {
    const year = post.date.getFullYear();
    const month = post.date.toLocaleString('en-US', { month: 'long' });
    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = [];
    grouped[year][month].push(post);
  });

  res.render('archives', { grouped, title: 'Archive & Timeline' });
});

app.get('/stats', async (req, res) => {
  const isAuth = checkAuth(req);
  const posts = await loadPosts({ includeAll: isAuth });
  const stats = getDiaryStats(posts);

  res.render('stats', { stats, title: 'Diary Analytics & Activity Heatmap' });
});

app.get('/about', (req, res) => {
  res.render('about', { title: 'About Me' });
});

app.get('/cv', (req, res) => {
  res.render('cv', { title: 'Curriculum Vitae' });
});

app.get('/publications', (req, res) => {
  let publications = [];
  if (fs.existsSync(PUBLICATIONS_DIR)) {
    const files = fs.readdirSync(PUBLICATIONS_DIR).filter(f => f.endsWith('.md'));
    publications = files.map(file => {
      const content = fs.readFileSync(path.join(PUBLICATIONS_DIR, file), 'utf-8');
      const { data } = matter(content);
      return {
        title: data.title || file,
        date: new Date(data.date),
        venue: data.venue || 'Research Note',
        paperurl: data.paperurl || '#',
        citation: data.citation || ''
      };
    }).sort((a, b) => b.date - a.date);
  }

  res.render('publications', { publications, title: 'Publications & Projects' });
});

app.get('/feed', async (req, res) => {
  const posts = (await loadPosts({ includeAll: false })).slice(0, 25);
  res.type('application/xml');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0"><channel>\n';
  xml += `<title>${SITE_TITLE}</title>\n`;
  xml += `<link>https://mutedmiles.space</link>\n`;
  xml += `<description>${SITE_SUBTITLE}</description>\n`;
  
  posts.forEach(post => {
    xml += `  <item>\n`;
    xml += `    <title><![CDATA[${post.title}]]></title>\n`;
    xml += `    <link>https://mutedmiles.space/post/${post.slug}</link>\n`;
    xml += `    <guid>https://mutedmiles.space/post/${post.slug}</guid>\n`;
    xml += `    <pubDate>${post.date.toUTCString()}</pubDate>\n`;
    xml += `    <description><![CDATA[${post.excerpt}]]></description>\n`;
    xml += `  </item>\n`;
  });
  
  xml += '</channel></rss>';
  res.send(xml);
});

app.get('/sitemap', async (req, res) => {
  const posts = await loadPosts({ includeAll: false });
  res.type('application/xml');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `  <url><loc>https://mutedmiles.space/</loc></url>\n`;
  xml += `  <url><loc>https://mutedmiles.space/archives</loc></url>\n`;
  xml += `  <url><loc>https://mutedmiles.space/stats</loc></url>\n`;
  xml += `  <url><loc>https://mutedmiles.space/about</loc></url>\n`;
  
  posts.forEach(post => {
    xml += `  <url><loc>https://mutedmiles.space/post/${post.slug}</loc></url>\n`;
  });
  
  xml += '</urlset>';
  res.send(xml);
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.get('/login', (req, res) => {
  if (checkAuth(req)) {
    return res.redirect(req.query.next || '/admin');
  }
  res.render('login', { 
    title: 'Admin Authentication', 
    error: null,
    next: req.query.next || '/admin'
  });
});

app.post('/login', authLimiter, (req, res) => {
  const { password, next: nextUrl } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    const token = generateAuthToken();
    res.cookie('diary_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    return res.redirect(nextUrl || '/admin');
  }

  res.render('login', {
    title: 'Admin Authentication',
    error: 'Incorrect admin password. Please try again.',
    next: nextUrl || '/admin'
  });
});

app.get('/logout', (req, res) => {
  res.clearCookie('diary_auth');
  res.redirect('/');
});

// ==========================================
// WEB WRITER / ADMIN DASHBOARD
// ==========================================

app.get('/admin', requireWebAuth, async (req, res) => {
  const allPosts = await loadPosts({ includeAll: true });
  const stats = getDiaryStats(allPosts);
  
  res.render('admin', {
    title: 'Publisher Dashboard',
    postToEdit: null,
    posts: allPosts,
    stats,
    apiKey: API_KEY,
    port: PORT,
    message: req.query.msg || null
  });
});

app.get('/write', requireWebAuth, (req, res) => {
  res.redirect('/admin');
});

app.get('/admin/edit/:slug', requireWebAuth, async (req, res) => {
  const allPosts = await loadPosts({ includeAll: true });
  const postToEdit = allPosts.find(p => p.slug === req.params.slug);
  
  if (!postToEdit) {
    return res.redirect('/admin?msg=Post%20not%20found');
  }

  const stats = getDiaryStats(allPosts);
  res.render('admin', {
    title: `Editing: ${postToEdit.title}`,
    postToEdit,
    posts: allPosts,
    stats,
    apiKey: API_KEY,
    port: PORT,
    message: null
  });
});

app.post('/admin/save', requireWebAuth, async (req, res) => {
  try {
    const { 
      originalFilename, 
      slug, 
      title, 
      content, 
      date, 
      categories, 
      tags, 
      mood, 
      visibility, 
      excerpt, 
      pinned 
    } = req.body;

    const result = await savePostFile({
      originalFilename,
      slug,
      title,
      content,
      date,
      categories,
      tags,
      mood,
      visibility,
      excerpt,
      pinned: pinned === 'on' || pinned === 'true' || Boolean(pinned)
    });

    res.redirect(`/post/${result.slug}`);
  } catch (error) {
    console.error('Error saving post from admin:', error);
    res.redirect(`/admin?msg=Error:%20${encodeURIComponent(error.message)}`);
  }
});

app.post('/admin/delete/:slug', requireWebAuth, async (req, res) => {
  try {
    await deletePostFile(req.params.slug);
    res.redirect('/admin?msg=Post%20deleted%20successfully');
  } catch (error) {
    console.error('Error deleting post:', error);
    res.redirect(`/admin?msg=Error%20deleting%20post`);
  }
});

// ==========================================
// REST API ROUTES
// ==========================================

app.post('/api/posts', authLimiter, upload.none(), requireApiAuth, async (req, res) => {
  try {
    let { 
      title, 
      content, 
      slug, 
      date, 
      categories, 
      tags, 
      mood, 
      visibility, 
      excerpt, 
      pinned 
    } = req.body || {};

    if (typeof req.body === 'string') {
      content = req.body;
      title = req.headers['x-title'] || title;
      mood = req.headers['x-mood'] || mood;
      categories = req.headers['x-category'] || categories;
      tags = req.headers['x-tags'] || tags;
      visibility = req.headers['x-visibility'] || visibility;
    }

    if (!title && !content) {
      return res.status(400).json({ error: 'Title or content is required.' });
    }

    const result = await savePostFile({
      slug,
      title: title || 'Quick Log ' + new Date().toISOString().split('T')[0],
      content: content || '',
      date,
      categories,
      tags,
      mood,
      visibility: visibility || 'public',
      excerpt,
      pinned: pinned === 'true' || pinned === true
    });

    return res.status(201).json({
      success: true,
      message: 'Diary entry published successfully!',
      post: result
    });
  } catch (err) {
    console.error('API Post Creation Error:', err);
    return res.status(500).json({ error: 'Failed to create post', details: err.message });
  }
});

app.put('/api/posts/:slug', authLimiter, upload.none(), requireApiAuth, async (req, res) => {
  try {
    const existing = await loadSinglePost(req.params.slug);
    if (!existing) {
      return res.status(404).json({ error: 'Post not found with provided slug' });
    }

    const { 
      title, 
      content, 
      newSlug, 
      date, 
      categories, 
      tags, 
      mood, 
      visibility, 
      excerpt, 
      pinned 
    } = req.body || {};

    const result = await savePostFile({
      originalFilename: existing.filename,
      slug: newSlug || existing.slug,
      title: title !== undefined ? title : existing.title,
      content: content !== undefined ? content : existing.rawContent,
      date: date || existing.date,
      categories: categories !== undefined ? categories : existing.categories,
      tags: tags !== undefined ? tags : existing.tags,
      mood: mood !== undefined ? mood : existing.mood,
      visibility: visibility !== undefined ? visibility : existing.visibility,
      excerpt: excerpt !== undefined ? excerpt : existing.excerpt,
      pinned: pinned !== undefined ? (pinned === 'true' || pinned === true) : existing.pinned
    });

    return res.json({
      success: true,
      message: 'Post updated successfully',
      post: result
    });
  } catch (err) {
    console.error('API Post Update Error:', err);
    return res.status(500).json({ error: 'Failed to update post', details: err.message });
  }
});

app.delete('/api/posts/:slug', authLimiter, requireApiAuth, async (req, res) => {
  try {
    await deletePostFile(req.params.slug);
    return res.json({ success: true, message: `Post deleted successfully` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete post', details: err.message });
  }
});

app.get('/api/posts', async (req, res) => {
  const isAuth = checkAuth(req);
  const posts = await loadPosts({ includeAll: isAuth });
  
  const simplified = posts.map(p => ({
    slug: p.slug,
    title: p.title,
    date: p.date.toISOString().split('T')[0],
    categories: p.categories,
    tags: p.tags,
    mood: p.mood,
    visibility: p.visibility,
    pinned: p.pinned,
    excerpt: p.excerpt,
    wordCount: p.wordCount,
    readingTime: p.readingTime,
    url: `/post/${p.slug}`
  }));

  res.json({ count: simplified.length, posts: simplified });
});

app.post('/api/upload', authLimiter, requireApiAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use form field name "file" or "image".' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const isImg = req.file.mimetype.startsWith('image/');
  const markdown = isImg 
    ? `![${req.file.originalname}](${fileUrl})`
    : `[Download ${req.file.originalname}](${fileUrl})`;

  return res.status(201).json({
    success: true,
    message: 'File uploaded successfully',
    filename: req.file.filename,
    url: fileUrl,
    markdown
  });
});

app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  if (query.length < 2) {
    return res.json([]);
  }

  const isAuth = checkAuth(req);
  const posts = await loadPosts({ includeAll: isAuth });
  
  const results = posts.filter(p => 
    p.title.toLowerCase().includes(query) ||
    p.excerpt.toLowerCase().includes(query) ||
    p.tags.some(t => t.toLowerCase().includes(query)) ||
    (p.mood && p.mood.toLowerCase().includes(query))
  ).slice(0, 10).map(p => ({
    title: p.title,
    slug: p.slug,
    date: p.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    tags: p.tags,
    mood: p.mood,
    visibility: p.visibility
  }));

  res.json(results);
});

app.get('/api/stats', async (req, res) => {
  const isAuth = checkAuth(req);
  const posts = await loadPosts({ includeAll: isAuth });
  const stats = getDiaryStats(posts);
  res.json(stats);
});

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
  res.status(500).send(`<h3>Server Error</h3><p>${err.message}</p>`);
});

// Start Server (if not imported by Vercel serverless runtime)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Diary & Blog Platform running at: http://localhost:${PORT}`);
    console.log(`✍️ Web Admin / Writer UI:           http://localhost:${PORT}/admin`);
    console.log(`🔑 Publishing API Endpoint:          POST http://localhost:${PORT}/api/posts`);
    console.log(`======================================================\n`);
  });
}

export default app;
