import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const BASE = 'https://open.feishu.cn/open-apis';

// Load .env
const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

// Feishu app / tables
const APP_TOKEN = 'LTSYbp80TaZ19gsy0YHc2R3Xn6z';
const BOOKS_TABLE = 'tblrv6nJhuK0dlwY';   // 书籍库
const NOTES_TABLE = 'tblT5VmW6FylMs2z';   // 笔记库
const FEISHU_APP_ID = env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;

// Cache
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getTenantToken() {
  const r = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error('tenant token failed: ' + JSON.stringify(j));
  return j.tenant_access_token;
}

async function getUserToken() {
  try {
    const t = JSON.parse(fs.readFileSync('.user_token.json', 'utf8'));
    if (Date.now() - t.got_at < (t.expires_in - 300) * 1000) return t.access_token;
  } catch {}
  throw new Error('user token expired or missing. Re-run oauth_server.mjs');
}

// ---- helpers ----
function colorFromTitle(title) {
  const colors = [
    '#e8b4b4', '#d4a5a5', '#c99797', '#be8989',
    '#b4a7c8', '#a69bc2', '#988fbc', '#8a83b6',
    '#94c4bf', '#86b8b3', '#78aca7', '#6aa09b',
    '#c4bd94', '#b8b187', '#aca57a', '#a0996d',
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).join(', ');
  if (typeof v === 'object') {
    if (v.text != null) return v.text;
    if (v.name != null) return v.name;
    return JSON.stringify(v);
  }
  return String(v);
}

async function getCover(attField, token) {
  if (!Array.isArray(attField) || !attField[0]) return null;
  const att = attField[0];
  const ft = att.file_token;
  const ext = (att.name && att.name.includes('.')) ? att.name.split('.').pop() : 'png';
  const local = path.join(__dirname, 'covers', `${ft}.${ext}`);
  if (fs.existsSync(local)) return `covers/${ft}.${ext}`;
  try {
    const r = await fetch(att.url, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    fs.mkdirSync(path.join(__dirname, 'covers'), { recursive: true });
    fs.writeFileSync(local, buf);
    return `covers/${ft}.${ext}`;
  } catch {
    return null;
  }
}

// Map a 笔记库 record
function mapNote(rec) {
  const f = rec.fields || {};
  const tags = Array.isArray(f['笔记标签'])
    ? f['笔记标签'].map(asText)
    : (f['笔记标签'] ? [asText(f['笔记标签'])] : []);
  return {
    id: rec.record_id,
    bookTitle: asText(f['所属书籍']),
    summary: asText(f['笔记摘要']),
    excerpt: asText(f['原文摘录']),
    thinking: asText(f['我的思考/评论']),
    critique: asText(f['观点批判']),
    tags,
    createdAt: f['创建时间'] || null,
  };
}

// Map a 书籍库 record (cover resolved later)
function mapBook(rec) {
  const f = rec.fields || {};
  let rating = 0;
  if (typeof f['综合评分'] === 'number') rating = Math.round(f['综合评分']);
  const statusMap = { '想读': 'to-read', '在读': 'reading', '已读': 'finished', '读完': 'finished' };
  const statusCode = statusMap[f['阅读状态']] || 'reading';
  const statusLabel = asText(f['阅读状态'] || '在读');
  const category = asText(f['书籍分类'] || '');
  const year = f['创建时间'] ? new Date(f['创建时间']).getFullYear() : new Date().getFullYear();
  const date = f['创建时间'] ? new Date(f['创建时间']).toISOString().slice(0, 10) : '';
  // 读书笔记 is a linked-record field -> contains record_ids pointing to 笔记库
  const link = f['读书笔记'];
  let linkedIds = [];
  if (Array.isArray(link) && link[0] && Array.isArray(link[0].record_ids)) {
    linkedIds = link[0].record_ids;
  }
  const title = asText(f['书名'] || '未命名');
  return {
    id: rec.record_id,
    title,
    author: asText(f['作者'] || '未知'),
    _coverField: f['封面'] || null,
    category,
    status: statusCode,
    statusLabel,
    rating, year, date,
    _linkedIds: linkedIds,
  };
}

// Fetch both tables and join
async function fetchBooks() {
  let token;
  try { token = await getUserToken(); } catch { token = await getTenantToken(); }
  const headers = { Authorization: 'Bearer ' + token };

  // Notes (笔记库)
  const notesRes = await fetch(
    `${BASE}/bitable/v1/apps/${APP_TOKEN}/tables/${NOTES_TABLE}/records?page_size=500`,
    { headers }
  );
  const notesJson = await notesRes.json();
  if (notesJson.code !== 0) throw new Error('notes fetch failed: ' + JSON.stringify(notesJson).slice(0, 200));
  const notes = (notesJson.data?.items || []).map(mapNote);
  const noteById = Object.fromEntries(notes.map((n) => [n.id, n]));

  // Books (书籍库)
  const booksRes = await fetch(
    `${BASE}/bitable/v1/apps/${APP_TOKEN}/tables/${BOOKS_TABLE}/records?page_size=500`,
    { headers }
  );
  const booksJson = await booksRes.json();
  if (booksJson.code !== 0) throw new Error('books fetch failed: ' + JSON.stringify(booksJson).slice(0, 200));

  const rawBooks = (booksJson.data?.items || []).map((r) => mapBook(r));
  const books = [];
  for (const b of rawBooks) {
    let detailed = [];
    if (b._linkedIds.length) {
      detailed = b._linkedIds.map((id) => noteById[id]).filter(Boolean);
    }
    if (detailed.length === 0) {
      detailed = notes.filter((n) => n.bookTitle && n.bookTitle === b.title);
    }
    detailed.sort((a, c) => (a.createdAt || 0) - (c.createdAt || 0));

    const noteTags = [...new Set(detailed.flatMap((n) => n.tags))];
    const tags = [...new Set([b.category, ...noteTags].filter(Boolean))];
    const summary = detailed[0]?.summary || '';
    const bookNoteText = detailed.map((n) => n.summary).filter(Boolean).join('；');
    const searchText = [
      b.title, b.author, b.category,
      detailed.map((n) => [n.summary, n.excerpt, n.thinking, n.critique, n.tags.join(' ')].join(' ')).join(' '),
    ].join(' ');

    const cover = await getCover(b._coverField, token);

    books.push({
      id: b.id,
      title: b.title,
      author: b.author,
      cover,
      category: b.category,
      status: b.status,
      statusLabel: b.statusLabel,
      rating: b.rating,
      year: b.year,
      date: b.date,
      tags,
      color: colorFromTitle(b.title),
      summary,
      notes: bookNoteText,
      detailedNotes: detailed,
      searchText,
    });
  }

  return {
    books,
    total: books.length,
    source: 'feishu-bitable-realtime',
    fetchedAt: new Date().toISOString(),
  };
}

// ---- static + api ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/books') {
    try {
      const now = Date.now();
      if (!cache || now - cacheTime > CACHE_TTL) {
        cache = await fetchBooks();
        cacheTime = now;
        console.log(`[${new Date().toLocaleTimeString()}] Fetched ${cache.books.length} books (with ${cache.books.reduce((s,b)=>s+b.detailedNotes.length,0)} notes) from Feishu`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] Serving cached (${Math.round((CACHE_TTL - (now - cacheTime)) / 1000)}s remaining)`);
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(cache));
    } catch (e) {
      console.error('API error:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }
  const ext = path.extname(filePath);
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      const index = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(index);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  }
}).listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║  📖 读书手帐 — 飞书实时版           ║
║  http://localhost:${PORT}              ║
║  API: /api/books                     ║
╚══════════════════════════════════════╝
  `);
});
