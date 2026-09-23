# 📓 Self-Hosted Personal Diary & Engineering Log

A fast, lightweight, and cyberpunk/terminal-styled self-hosted personal diary and blog platform. Built with **Node.js, Express, EJS, and Markdown flat-file storage**, featuring a **REST API with Bearer token authentication**, **split-pane live Markdown web writer**, and **activity heatmap analytics**.

---

## ✨ Features

- 🖥️ **Cyberpunk / Terminal Dark & Light Theme**: Audio visualizer canvas, typing hero header, sound effects, and ambient lofi audio player.
- 📡 **Authenticated REST API**: Expose `POST /api/posts` and `POST /api/upload` protected by Bearer token or API key for publishing from terminal, iOS Shortcuts, Python scripts, or Obsidian.
- ✍️ **Split-Screen Web Writer (`/admin` or `/write`)**: Live real-time Markdown preview, image drag-and-drop & paste upload, mood picker, tag pills, and word counter.
- 🔒 **Privacy Visibility Tiers**:
  - `public`: Visible to all site visitors.
  - `private`: Hidden from public feed, only viewable when authenticated.
  - `unlisted`: Accessible only via direct secret URL slug.
- 📊 **Writing Analytics & Heatmap (`/stats`)**: GitHub-style 52-week activity heatmap, daily streaks, word count metrics, and mood distribution tracker.
- ⚡ **Zero-Database Markdown Storage**: Entries are saved as clean `.md` files in `_posts/` with YAML frontmatter, making them 100% portable and Git-friendly.
- 🔍 **Live Search & Tags**: Instant search dropdown, category filtering, tag filtering, and chronological archive.
- 📱 **Mobile Ready**: Fully responsive layout with mobile drawer navigation.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Copy `.env.example` to `.env` or customize:
```env
PORT=3000
ADMIN_PASSWORD=your_secure_password
API_KEY=your_secret_api_token
SESSION_SECRET=your_session_secret_key
SITE_TITLE=[ CODERATWORK7 ]
SITE_SUBTITLE=ML Research Engineer & Neural Logs
SITE_AUTHOR=CODERATWORK7
```

### 3. Start the Server
```bash
# Development mode with live reload
npm run dev

# Production mode
npm start
```
Visit `http://localhost:3000` in your browser.

---

## 🔑 Accessing the Admin / Writer
1. Navigate to `http://localhost:3000/admin` (or click `🔑` in the top navigation).
2. Enter your `ADMIN_PASSWORD`.
3. Use the live Markdown editor to publish, edit existing posts, or check API keys and code snippets.

---

## 📲 Publishing via Terminal / API

Publish directly from your command line:
```bash
./diary.sh --title "Evening Notes" --content "Finished optimizing audio model" --mood "⚡ Productive" --tags "ml,speech"
```

Or via cURL:
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer diary_secret_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Thoughts Today",
    "content": "Reflecting on system architecture...",
    "mood": "💡 Inspired",
    "visibility": "public"
  }'
```

*See [API_GUIDE.md](file:///home/cdrwrk7/diary-website/API_GUIDE.md) for full API documentation, Python examples, and iOS Shortcuts setup.*

---

## 📁 Project Structure

```
diary-website/
├── _posts/                 # Markdown diary files (YYYY-MM-DD-slug.md)
├── _publications/          # Research & publication notes
├── public/                 # Static assets
│   ├── app.js              # Theme switcher, search, animations, lightbox
│   ├── style.css           # Styling & cyberpunk theme
│   ├── audio/              # Ambient background track
│   └── uploads/            # Uploaded images & attachments
├── views/                  # EJS template views
│   ├── layout.ejs          # Master layout with navbar & audio
│   ├── index.ejs           # Journal feed with streak banner
│   ├── post.ejs            # Single post view
│   ├── admin.ejs           # Markdown writer & entry manager
│   ├── stats.ejs           # Writing analytics & activity heatmap
│   ├── login.ejs           # Admin password authentication
│   ├── archives.ejs        # Year & month timeline
│   ├── category.ejs        # Category posts view
│   ├── tag.ejs             # Tag posts view
│   └── 404.ejs             # Error page
├── scripts/
│   └── publish.js          # CLI publisher script
├── diary.sh                # Executable bash wrapper
├── server.js               # Express server & API endpoints
├── API_GUIDE.md            # Detailed API documentation
├── package.json
└── .env                    # Secrets & configuration
```
