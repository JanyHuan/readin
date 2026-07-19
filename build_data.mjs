// build_data.mjs — 拉取飞书数据并生成静态 data/books.json + 下载封面到 covers/
// 本地：node build_data.mjs   |   GitHub Actions 中自动运行（注入 Secrets）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchBooks } from './feishu_data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const data = await fetchBooks();
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.writeFileSync(
  path.join(__dirname, 'data', 'books.json'),
  JSON.stringify(data, null, 2)
);

const noteCount = data.books.reduce((s, b) => s + b.detailedNotes.length, 0);
const coverCount = data.books.filter((b) => b.cover).length;
console.log(`✅ 已生成 data/books.json：${data.books.length} 本书 / ${noteCount} 条笔记 / ${coverCount} 张封面`);
