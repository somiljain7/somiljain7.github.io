# 📖 Diary Publishing REST API Guide

This diary website provides a secure, lightweight REST API allowing you to publish and manage diary entries and upload media from anywhere (terminal, phone, iOS Shortcuts, Obsidian, automation scripts).

---

## 🔐 Authentication

All API write endpoints (`POST`, `PUT`, `DELETE`) require authentication. You can authenticate using any of the following methods:

1. **Bearer Token (Recommended)**:
   ```http
   Authorization: Bearer YOUR_API_KEY
   ```
2. **Custom Header**:
   ```http
   X-API-Key: YOUR_API_KEY
   ```
3. **Query Parameter**:
   ```http
   ?api_key=YOUR_API_KEY
   ```

*Your `API_KEY` is configured in your `.env` file.*

---

## 📡 API Endpoints

### 1. Create a New Diary Entry
`POST /api/posts`

#### Request Body (JSON):
```json
{
  "title": "Scaling Realtime Audio & Diary Update",
  "content": "## Today's Engineering Progress\n- Reduced latency to 120ms\n- Integrated speaker diarization stream\n\n![Diagram](/uploads/audio_flow.png)",
  "category": "Engineering",
  "tags": ["ml", "speech", "audio", "daily"],
  "mood": "⚡ Productive",
  "visibility": "public",
  "date": "2026-09-23",
  "slug": "scaling-realtime-audio",
  "pinned": false
}
```

#### Field Details:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | string | Yes | Title of the post |
| `content` | string | Yes | Markdown content body |
| `category` | string | No | Category name (default: `Journal`) |
| `tags` | array / string | No | List of tags or comma-separated string |
| `mood` | string | No | Mood badge emoji/text (e.g. `⚡ Productive`, `💡 Inspired`, `☕ Deep Work`, `🌿 Relaxed`) |
| `visibility` | string | No | `public` (default), `private` (admin only), or `unlisted` (secret link) |
| `date` | string | No | `YYYY-MM-DD` date (default: today) |
| `slug` | string | No | Custom URL slug (default: auto-generated from title) |
| `pinned` | boolean | No | Pin post to the top of the feed |

#### Response (`201 Created`):
```json
{
  "success": true,
  "message": "Diary entry published successfully!",
  "post": {
    "filename": "2026-09-23-scaling-realtime-audio.md",
    "slug": "scaling-realtime-audio",
    "title": "Scaling Realtime Audio & Diary Update",
    "url": "/post/scaling-realtime-audio"
  }
}
```

---

### 2. Update an Existing Entry
`PUT /api/posts/:slug`

#### Request Body (JSON):
```json
{
  "content": "Updated content with additional evening reflections...",
  "mood": "🚀 Shipped"
}
```

---

### 3. Delete an Entry
`DELETE /api/posts/:slug`

#### Response:
```json
{
  "success": true,
  "message": "Post 'Scaling Realtime Audio & Diary Update' deleted successfully"
}
```

---

### 4. Upload Images & Attachments
`POST /api/upload`

#### Request:
- Form data with field `file` containing the image, audio, or PDF file.

#### Response (`201 Created`):
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "filename": "1727076000000-screenshot.png",
  "url": "/uploads/1727076000000-screenshot.png",
  "markdown": "![screenshot.png](/uploads/1727076000000-screenshot.png)"
}
```

---

### 5. List Posts
`GET /api/posts`

* Public calls return public posts.
* Authenticated calls (with Bearer token) return all posts including private and unlisted.

---

### 6. Activity & Writing Statistics
`GET /api/stats`

Returns streak count, total words, category counts, mood counts, and daily entry heatmap counts.

---

## 💻 Code Examples & Quick Publishing

### cURL Example
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer diary_secret_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Midnight Thoughts on Architecture",
    "content": "Wrote the new diary ingestion pipeline tonight.",
    "mood": "⚡ Productive",
    "tags": ["systems", "architecture"],
    "visibility": "public"
  }'
```

### Python Script
```python
import requests

API_URL = "http://localhost:3000/api/posts"
API_KEY = "diary_secret_token_2026"

payload = {
    "title": "Python Automated Log",
    "content": "Pushing notes directly from an automated training run.",
    "category": "Experiments",
    "tags": ["ml", "training"],
    "mood": "🧠 Learning"
}

resp = requests.post(
    API_URL,
    json=payload,
    headers={"Authorization": f"Bearer {API_KEY}"}
)

print(resp.json())
```

### Terminal CLI Helper
```bash
./diary.sh --title "Quick Log" --content "Finished sprint tasks." --mood "⚡ Productive"
```

### Apple iOS Shortcuts / Mobile Quick Journal
1. Open **Shortcuts** app on iPhone / iPad.
2. Add action: **Ask for Input** (Prompt: "Diary Title").
3. Add action: **Ask for Input** (Prompt: "What's on your mind?").
4. Add action: **Get Contents of URL**:
   - URL: `https://your-domain.com/api/posts`
   - Method: `POST`
   - Headers: `Authorization: Bearer YOUR_API_KEY`
   - Request Body: JSON with `title`, `content`, `mood: "⚡ Mobile Quick Entry"`.
5. Run the shortcut from your home screen widget for instant 1-tap journaling.
