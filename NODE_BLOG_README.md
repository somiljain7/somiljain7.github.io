# Lightweight Node.js Blog

A minimal, CPU-efficient blog application powered by Node.js. Converts your Jekyll blog to a lightweight Express.js app.

## Features

✅ **Lightweight** - Minimal dependencies, ~5MB disk footprint  
✅ **Fast** - In-memory caching, compression enabled  
✅ **Dark Mode** - System preference support  
✅ **Search** - Live search across posts  
✅ **Categories & Tags** - Full navigation support  
✅ **Markdown** - Native markdown post support  
✅ **Responsive** - Mobile-first design  
✅ **RSS Feed** - Feed generation included  
✅ **Sitemap** - Auto-generated sitemaps  

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000` to see your blog!

### 3. Production Deploy

```bash
npm start
```

Set `PORT` environment variable to change the port (default: 3000).

## Project Structure

```
├── server.js                 # Main Express app
├── package.json              # Dependencies
├── public/
│   ├── style.css            # Styling + dark mode
│   └── app.js               # Client-side interactivity
├── views/
│   ├── layout.ejs           # Main template
│   ├── index.ejs            # Blog index
│   ├── post.ejs             # Single post
│   ├── category.ejs         # Category page
│   ├── tag.ejs              # Tag page
│   ├── archives.ejs         # Archives
│   └── 404.ejs              # 404 page
└── _posts/                  # Your blog posts (markdown)
```

## Writing Posts

Posts are standard markdown files in `_posts/` with YAML front matter:

```markdown
---
title: "My Post Title"
date: 2025-12-15
categories: [tech, tutorial]
tags: [javascript, nodejs]
excerpt: "Short description here"
---

# Your content starts here

This is your post content...
```

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Home / blog index |
| `/post/:slug` | Single post |
| `/category/:name` | Posts by category |
| `/tag/:name` | Posts by tag |
| `/archives` | Archive by year |
| `/api/search?q=query` | Search API (JSON) |
| `/feed` | RSS feed |
| `/sitemap` | XML sitemap |

## Environment Variables

```bash
PORT=3000                    # Server port (default: 3000)
NODE_ENV=production         # Set to 'production' for optimization
```

## Deployment

### Self-Hosted (VPS/Server)

1. Clone the repo or push to your server
2. Install Node.js (v18+)
3. Run `npm install`
4. Start with `npm start`
5. Use PM2 or systemd for auto-restart

**PM2 Example:**
```bash
npm install -g pm2
pm2 start server.js --name "blog"
pm2 startup
pm2 save
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t my-blog .
docker run -p 3000:3000 my-blog
```

## Performance

- **Memory Usage**: ~30-50MB
- **CPU**: Minimal (idle ~0%)
- **First Load**: <200ms
- **Post Load**: <50ms (cached)

Post cache auto-refreshes every 5 minutes.

## Customization

### Change Site Title

Edit `server.js` line 12 and update any template references.

### Modify Styling

Edit `public/style.css` for custom colors, fonts, and layouts.

### Change Colors

Update CSS variables in `public/style.css`:

```css
:root {
  --bg: #ffffff;
  --fg: #333333;
  --accent: #0066cc;
  --border: #e0e0e0;
  --card-bg: #f9f9f9;
}
```

## Troubleshooting

**Posts not showing?**
- Ensure markdown files are in `_posts/` folder
- Check front matter formatting (YAML between `---`)

**Dark mode not working?**
- Check browser localStorage permissions
- Verify `public/app.js` is loaded

**Search not working?**
- Wait for post cache to load (5 min max)
- Check query length (minimum 2 characters)

## License

MIT

---

Made with ❤️ for lightweight blogging
