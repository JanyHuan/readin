// feishu_data.mjs — 共享取数模块（本地与 GitHub Actions 通用）
// 产出：拉取飞书多维表格「书籍库」+「笔记库」，按关联记录 join，返回标准化 books 数组。
// 封面下载到本地 covers/（相对路径），无鉴权也能被静态站点直接引用。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://open.feishu.cn/open-apis';

// 飞书多维表格 app_token 与子表（从 wiki 节点解析得到，已固定）
const APP_TOKEN = 'LTSYbp80TaZ19gsy0YHc2R3Xn6z';
const BOOKS_TABLE = 'tblrv6nJhuK0dlwY'; // 书籍库
const NOTES_TABLE = 'tblT5VmW6FylMs2z'; // 笔记库

// --- 读取 .env（本地用；GitHub Actions 用环境变量，忽略 .env） ---
function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}
const env = loadEnv();
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || env.FEISHU_APP_SECRET;

// ---------- token 获取 ----------
// 优先：用 refresh_token（非交互）刷新出 user_access_token（用户身份，已生效权限）
async function getUserTokenByRefresh() {
  let rt = process.env.FEISHU_REFRESH_TOKEN;
  if (!rt) {
    try { rt = JSON.parse(fs.readFileSync(path.join(__dirname, '.user_token.json'), 'utf8')).refresh_token; } catch {}
  }
  if (!rt) return null;
  try {
    const r = await fetch(`${BASE}/authen/v2/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: FEISHU_APP_ID,
        client_secret: FEISHU_APP_SECRET,
        refresh_token: rt,
      }),
    });
    const j = await r.json();
    const data = j.data || j;
    if (j.code === 0 && data.access_token) {
      // 飞书 refresh_token 每次刷新都会轮换：把新令牌写回文件，供工作流持久化到 Secrets（避免下次失效）
      if (process.env.GITHUB_ACTIONS && data.refresh_token) {
        try { fs.writeFileSync(path.join(__dirname, '.new_refresh_token'), String(data.refresh_token)); } catch {}
      }
      return data.access_token;
    }
    console.warn('refresh_token 失效，转 tenant:', j.msg);
  } catch (e) {
    console.warn('refresh 失败:', e.message);
  }
  return null;
}

// 兜底：应用身份 token（需 bitable:app 应用身份权限已发布；当前未发布，通常失败）
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

async function getToken() {
  const t = await getUserTokenByRefresh();
  if (t) return t;
  return await getTenantToken();
}

// ---------- 字段解析 ----------
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

async function fetchBooks() {
  const token = await getToken();
  const headers = { Authorization: 'Bearer ' + token };

  const notesRes = await fetch(
    `${BASE}/bitable/v1/apps/${APP_TOKEN}/tables/${NOTES_TABLE}/records?page_size=500`,
    { headers }
  );
  const notesJson = await notesRes.json();
  if (notesJson.code !== 0) throw new Error('notes fetch failed: ' + JSON.stringify(notesJson).slice(0, 200));
  const notes = (notesJson.data?.items || []).map(mapNote);
  const noteById = Object.fromEntries(notes.map((n) => [n.id, n]));

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
    if (b._linkedIds.length) detailed = b._linkedIds.map((id) => noteById[id]).filter(Boolean);
    if (detailed.length === 0) detailed = notes.filter((n) => n.bookTitle && n.bookTitle === b.title);
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
      id: b.id, title: b.title, author: b.author,
      cover, category: b.category, status: b.status, statusLabel: b.statusLabel,
      rating: b.rating, year: b.year, date: b.date, tags,
      color: colorFromTitle(b.title), summary,
      notes: bookNoteText, detailedNotes: detailed, searchText,
    });
  }

  return { books, total: books.length, source: 'feishu-bitable', fetchedAt: new Date().toISOString() };
}

export { fetchBooks };
