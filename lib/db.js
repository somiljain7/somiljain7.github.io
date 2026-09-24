import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import 'dotenv/config';

let cachedClient = null;
let cachedDb = null;
let lastConnectionAttempt = 0;
const CONNECTION_COOLDOWN_MS = 15000;

// Helper to safely parse dates
function safePostDate(rawDate) {
  if (!rawDate) return new Date();
  const d = new Date(rawDate);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Connect to MongoDB with serverless connection pooling
export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'diary_db';

  if (!uri) {
    return null;
  }

  if (cachedDb) {
    return cachedDb;
  }

  // If a connection attempt recently failed, skip waiting for another timeout
  if (Date.now() - lastConnectionAttempt < CONNECTION_COOLDOWN_MS) {
    return null;
  }

  lastConnectionAttempt = Date.now();

  try {
    if (!cachedClient) {
      cachedClient = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
      });
      await cachedClient.connect();
    }

    cachedDb = cachedClient.db(dbName);

    // Ensure index on slug
    try {
      await cachedDb.collection('posts').createIndex({ slug: 1 }, { unique: true });
      await cachedDb.collection('posts').createIndex({ date: -1 });
      await cachedDb.collection('posts').createIndex({ visibility: 1 });
    } catch (e) {
      // Indexes already exist or created
    }

    return cachedDb;
  } catch (err) {
    console.warn('MongoDB connection error:', err.message);
    cachedClient = null;
    cachedDb = null;
    return null;
  }
}

// Calculate reading time & words helper
function calculateReadingTime(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return { minutes, words };
}

// Sync/Seed existing markdown files into MongoDB
export async function syncLocalPostsToMongo(postsDir) {
  try {
    const db = await getDb();
    if (!db || !fs.existsSync(postsDir)) return;

    const collection = db.collection('posts');
    const existingSlugs = new Set(await collection.distinct('slug'));
    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
      if (existingSlugs.has(slug)) {
        continue;
      }

      const fullPath = path.join(postsDir, file);
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const { data, content: body } = matter(fileContent);

      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      const postDate = data.date ? safePostDate(data.date) : (dateMatch ? safePostDate(dateMatch[1]) : new Date());

      const categories = Array.isArray(data.categories) 
        ? data.categories 
        : (data.categories ? [data.categories] : (data.category ? [data.category] : ['Engineering']));
        
      const tags = Array.isArray(data.tags) 
        ? data.tags 
        : (typeof data.tags === 'string' ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []);

      const stats = calculateReadingTime(body);
      const excerpt = data.excerpt || body.replace(/[#*`_~\[\]]/g, '').trim().substring(0, 160) + '...';
      const visibility = data.visibility || (data.private ? 'private' : 'public');

      const doc = {
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
        content: marked(body),
        updatedAt: new Date()
      };

      // Upsert post if not already existing
      await collection.updateOne(
        { slug },
        { $setOnInsert: { ...doc, createdAt: postDate } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn('MongoDB Seed Warning:', err.message);
  }
}

// Fetch all posts
export async function getMongoPosts(options = { includeAll: false }) {
  try {
    const db = await getDb();
    if (!db) return null;

    const query = options.includeAll ? {} : { visibility: 'public' };
    const docs = await db.collection('posts')
      .find(query)
      .sort({ pinned: -1, date: -1 })
      .toArray();

    return docs.map(doc => {
      const postDate = safePostDate(doc.date);
      return {
        filename: doc.filename || `${postDate.toISOString().split('T')[0]}-${doc.slug}.md`,
        slug: doc.slug,
        title: doc.title,
        date: postDate,
        categories: doc.categories || [],
        tags: doc.tags || [],
        mood: doc.mood || null,
        visibility: doc.visibility || 'public',
        pinned: Boolean(doc.pinned),
        excerpt: doc.excerpt || '',
        wordCount: doc.wordCount || 0,
        readingTime: doc.readingTime || 1,
        rawContent: doc.rawContent || '',
        content: doc.content || marked(doc.rawContent || '')
      };
    });
  } catch (err) {
    console.error('getMongoPosts error:', err.message);
    return null;
  }
}

// Fetch single post by slug
export async function getMongoPostBySlug(slug) {
  try {
    const db = await getDb();
    if (!db) return null;

    const doc = await db.collection('posts').findOne({ slug });
    if (!doc) return null;

    const postDate = safePostDate(doc.date);
    return {
      filename: doc.filename || `${postDate.toISOString().split('T')[0]}-${doc.slug}.md`,
      slug: doc.slug,
      title: doc.title,
      date: postDate,
      categories: doc.categories || [],
      tags: doc.tags || [],
      mood: doc.mood || null,
      visibility: doc.visibility || 'public',
      pinned: Boolean(doc.pinned),
      excerpt: doc.excerpt || '',
      wordCount: doc.wordCount || 0,
      readingTime: doc.readingTime || 1,
      rawContent: doc.rawContent || '',
      content: doc.content || marked(doc.rawContent || '')
    };
  } catch (err) {
    console.error('getMongoPostBySlug error:', err.message);
    return null;
  }
}

// Upsert post to MongoDB
export async function saveMongoPost(postData) {
  try {
    const db = await getDb();
    if (!db) return false;

    const d = postData.date ? new Date(postData.date) : new Date();
    const stats = calculateReadingTime(postData.content);
    const excerpt = postData.excerpt || postData.content.replace(/[#*`_~\[\]]/g, '').trim().substring(0, 160) + '...';

    const doc = {
      slug: postData.slug,
      title: postData.title,
      date: d,
      categories: Array.isArray(postData.categories) ? postData.categories : (postData.categories ? postData.categories.split(',').map(c => c.trim()).filter(Boolean) : ['Engineering']),
      tags: Array.isArray(postData.tags) ? postData.tags : (postData.tags ? postData.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      mood: postData.mood || null,
      visibility: postData.visibility || 'public',
      pinned: Boolean(postData.pinned),
      excerpt,
      wordCount: stats.words,
      readingTime: stats.minutes,
      rawContent: postData.content || '',
      content: marked(postData.content || ''),
      updatedAt: new Date()
    };

    await db.collection('posts').updateOne(
      { slug: postData.slug },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    return true;
  } catch (err) {
    console.error('saveMongoPost error:', err.message);
    return false;
  }
}

// Delete post from MongoDB
export async function deleteMongoPost(slug) {
  try {
    const db = await getDb();
    if (!db) return false;

    const res = await db.collection('posts').deleteOne({ slug });
    return res.deletedCount > 0;
  } catch (err) {
    console.error('deleteMongoPost error:', err.message);
    return false;
  }
}
