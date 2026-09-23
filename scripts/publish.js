#!/usr/bin/env node

import 'dotenv/config';

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'diary_secret_token_2026';
const API_URL = process.env.API_URL || `http://localhost:${PORT}/api/posts`;

// Parse command line arguments
const args = process.argv.slice(2);

function printHelp() {
  console.log(`
📖 Personal Diary CLI Publisher

Usage:
  node scripts/publish.js --title "Title" --content "Markdown body" [options]

Options:
  --title, -t        Title of the entry (required)
  --content, -c      Markdown content (required)
  --mood, -m         Mood badge (e.g. '⚡ Productive', '💡 Inspired', '☕ Deep Work')
  --category         Category (default: 'Journal')
  --tags             Comma-separated tags (e.g. 'ml,thoughts,daily')
  --visibility, -v   Visibility: 'public', 'private', or 'unlisted' (default: 'public')
  --slug             Custom slug/URL path (optional)
  --file, -f         Read content directly from a markdown/text file
  --help, -h         Show this help message

Examples:
  node scripts/publish.js -t "Evening Stream" -c "Worked on STT today" -m "⚡ Productive"
  node scripts/publish.js -t "Secret Note" -f notes.md --visibility private
`);
}

if (args.includes('-h') || args.includes('--help') || args.length === 0) {
  printHelp();
  process.exit(0);
}

let title = '';
let content = '';
let mood = null;
let category = 'Journal';
let tags = [];
let visibility = 'public';
let slug = null;
let filePath = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--title' || arg === '-t') {
    title = args[++i];
  } else if (arg === '--content' || arg === '-c') {
    content = args[++i];
  } else if (arg === '--mood' || arg === '-m') {
    mood = args[++i];
  } else if (arg === '--category') {
    category = args[++i];
  } else if (arg === '--tags') {
    tags = args[++i].split(',').map(t => t.trim()).filter(Boolean);
  } else if (arg === '--visibility' || arg === '-v') {
    visibility = args[++i];
  } else if (arg === '--slug') {
    slug = args[++i];
  } else if (arg === '--file' || arg === '-f') {
    filePath = args[++i];
  }
}

async function run() {
  if (filePath) {
    const fs = await import('fs');
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    } else {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
  }

  if (!title && !content) {
    console.error('❌ Error: --title or --content is required.');
    printHelp();
    process.exit(1);
  }

  const payload = {
    title: title || 'Quick Log ' + new Date().toISOString().split('T')[0],
    content: content || '',
    mood,
    category,
    tags,
    visibility,
    slug
  };

  try {
    console.log(`🚀 Sending entry to ${API_URL}...`);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error('❌ Failed to publish:', data.error || data.message || res.statusText);
      process.exit(1);
    }

    console.log(`\n✅ Published successfully!`);
    console.log(`📝 Title: ${data.post.title}`);
    console.log(`🔗 URL:   http://localhost:${PORT}${data.post.url}`);
    console.log(`📁 File:  _posts/${data.post.filename}\n`);
  } catch (err) {
    console.error('❌ Network error:', err.message);
    process.exit(1);
  }
}

run();
