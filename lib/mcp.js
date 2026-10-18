// Read-only routes for AI assistants: an MCP endpoint, llms.txt and a markdown version of each post.
// The MCP endpoint is stateless (a fresh server per request), which suits serverless hosting.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const ENTITIES = { '&times;': '×', '&middot;': '·', '&rarr;': '→', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' };

// Post bodies mix markdown with styled HTML blocks; assistants get clean text.
export function toPlainMarkdown(raw = '') {
  return String(raw)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '\n[figure]\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(b|strong|span|small|em|i|code|a)>(?=<)/gi, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(div|p|li|tr|h[1-6]|table|ol|ul)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const day = d => new Date(d).toISOString().slice(0, 10);
const isPublic = p => Boolean(p) && (p.visibility || 'public') === 'public';

function summary(p, siteUrl) {
  return {
    slug: p.slug,
    title: p.title,
    date: day(p.date),
    categories: p.categories,
    tags: p.tags,
    readingTimeMinutes: p.readingTime,
    excerpt: String(p.excerpt || '').replace(/\s+/g, ' ').trim(),
    url: `${siteUrl}/post/${p.slug}`,
    markdownUrl: `${siteUrl}/post/${p.slug}.md`
  };
}

const asText = obj => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });

function buildServer({ loadPosts, loadSinglePost, siteUrl, siteTitle, authorName }) {
  const server = new McpServer({ name: 'mutedmiles-blog', version: '1.0.0' });
  const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  const publicPosts = async () => (await loadPosts({ includeAll: false })).filter(isPublic);

  server.registerTool('list_posts', {
    title: 'List blog posts',
    description: `List public posts on ${authorName}'s blog (${siteUrl}), newest first. Optionally filter by tag or category.`,
    inputSchema: {
      tag: z.string().optional().describe('Only posts with this tag, e.g. "embeddings"'),
      category: z.string().optional().describe('Only posts in this category, e.g. "Engineering"'),
      limit: z.number().int().min(1).max(50).optional().describe('Maximum posts to return (default 20)')
    },
    annotations: readOnly
  }, async ({ tag, category, limit = 20 }) => {
    const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
    const posts = (await publicPosts())
      .filter(p => !tag || p.tags.some(t => eq(t, tag)))
      .filter(p => !category || p.categories.some(c => eq(c, category)))
      .slice(0, limit)
      .map(p => summary(p, siteUrl));
    return asText({ count: posts.length, posts });
  });

  server.registerTool('search_posts', {
    title: 'Search blog posts',
    description: `Full-text search over the titles, tags and bodies of public posts on ${authorName}'s blog. Every word must appear. Returns matching posts with a short snippet.`,
    inputSchema: {
      query: z.string().min(2).describe('Words to look for, e.g. "ONNX threads"'),
      limit: z.number().int().min(1).max(20).optional().describe('Maximum results (default 10)')
    },
    annotations: readOnly
  }, async ({ query, limit = 10 }) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results = [];
    for (const p of await publicPosts()) {
      const body = toPlainMarkdown(p.rawContent);
      const title = p.title.toLowerCase();
      const hay = `${title}\n${p.tags.join(' ')}\n${p.excerpt}\n${body}`.toLowerCase();
      if (!terms.every(t => hay.includes(t))) continue;
      const score = terms.reduce((s, t) => s + (title.includes(t) ? 10 : 0) + hay.split(t).length - 1, 0);
      const at = body.toLowerCase().indexOf(terms[0]);
      const snippet = at < 0 ? summary(p, siteUrl).excerpt : `…${body.slice(Math.max(0, at - 120), at + 200).replace(/\s+/g, ' ').trim()}…`;
      results.push({ score, ...summary(p, siteUrl), snippet });
    }
    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, limit).map(({ score, ...r }) => r);
    return asText({ query, count: top.length, results: top });
  });

  server.registerTool('get_post', {
    title: 'Read a blog post',
    description: 'Get the full text of one public post as markdown, by its slug (from list_posts or search_posts).',
    inputSchema: { slug: z.string().min(1).describe('Post slug, e.g. "choosing-an-embedding-model"') },
    annotations: readOnly
  }, async ({ slug }) => {
    const p = await loadSinglePost(slug);
    if (!isPublic(p)) {
      return { isError: true, content: [{ type: 'text', text: `No public post with slug "${slug}". Use list_posts to see slugs.` }] };
    }
    const meta = summary(p, siteUrl);
    return asText(`# ${p.title}\n\nBy ${authorName} · ${meta.date} · ${meta.url}\nTags: ${p.tags.join(', ')}\n\n${toPlainMarkdown(p.rawContent)}`);
  });

  server.registerTool('about_author', {
    title: 'About the author',
    description: `Who writes ${siteTitle}, what they work on, and where to find them.`,
    inputSchema: {},
    annotations: readOnly
  }, async () => asText({
    name: authorName,
    handle: siteTitle,
    role: 'ML Research Engineer',
    focus: ['speech processing', 'Indian-language voice agents', 'embeddings and retrieval', 'real-time systems'],
    site: siteUrl,
    about: `${siteUrl}/about`,
    cv: `${siteUrl}/cv`,
    publications: `${siteUrl}/publications`,
    feed: `${siteUrl}/feed`,
    github: ['https://github.com/coderatwork7', 'https://github.com/somiljain7'],
    x: 'https://x.com/coderatwork7',
    linkedin: 'https://www.linkedin.com/in/somiljain7/'
  }));

  return server;
}

export function mountAgentRoutes(app, opts) {
  const { loadPosts, loadSinglePost, siteUrl, siteTitle, authorName } = opts;

  const cors = (req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id'
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
  const limiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

  app.all('/mcp', cors, limiter, async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).set('Allow', 'POST, OPTIONS').json({
        jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed. This MCP server is stateless: send JSON-RPC with POST.' }, id: null
      });
    }
    const server = buildServer(opts);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP request failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  });

  // https://llmstxt.org: a plain index pointing assistants at the markdown versions.
  app.get('/llms.txt', async (req, res) => {
    const posts = (await loadPosts({ includeAll: false })).filter(isPublic);
    let txt = `# ${authorName} (${siteTitle})\n\n> Blog by ${authorName}, an ML research engineer: engineering notes on speech AI, Indian-language voice agents, embeddings and real-time systems.\n\n`;
    txt += `An MCP server for this blog is at ${siteUrl}/mcp (Streamable HTTP, read-only tools: list_posts, search_posts, get_post, about_author). Every post is also available as markdown at ${siteUrl}/post/<slug>.md.\n\n`;
    txt += `## Posts\n\n`;
    posts.forEach(p => { txt += `- [${p.title}](${siteUrl}/post/${p.slug}.md): ${String(p.excerpt || '').replace(/\s+/g, ' ').trim()}\n`; });
    txt += `\n## Pages\n\n- [About](${siteUrl}/about)\n- [CV](${siteUrl}/cv)\n- [Publications](${siteUrl}/publications)\n- [RSS feed](${siteUrl}/feed)\n`;
    res.type('text/plain; charset=utf-8').send(txt);
  });

  // The same post as clean markdown. Registered before the HTML post route.
  app.get(['/post/:slug.md', '/posts/:slug.md'], async (req, res, next) => {
    const p = await loadSinglePost(req.params.slug);
    if (!isPublic(p)) return next();
    res.type('text/markdown; charset=utf-8').send(`# ${p.title}\n\nBy ${authorName} · ${day(p.date)} · ${siteUrl}/post/${p.slug}\n\n${toPlainMarkdown(p.rawContent)}\n`);
  });
}
