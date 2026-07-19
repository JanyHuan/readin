// persist_refresh_token.cjs
// 在 GitHub Actions 中运行：读取 build 阶段写出的 .new_refresh_token（飞书轮换后的新令牌），
// 用 GH_PAT 调 GitHub API 把它更新回仓库 Secrets，避免下次定时同步因 refresh_token 失效而失败。
const sodium = require('libsodium-wrappers');
const fs = require('fs');

const GH_PAT = process.env.GH_PAT;
const REPO = process.env.GITHUB_REPOSITORY; // owner/repo
const TOKEN_FILE = '.new_refresh_token';
const SECRET_NAME = 'FEISHU_REFRESH_TOKEN';

if (!GH_PAT) { console.log('未配置 GH_PAT，跳过 refresh_token 持久化'); process.exit(0); }
if (!REPO || !REPO.includes('/')) { console.log('未识别仓库，跳过'); process.exit(0); }
if (!fs.existsSync(TOKEN_FILE)) { console.log('本次无新 refresh_token，跳过持久化'); process.exit(0); }

const newToken = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
if (!newToken) { console.log('refresh_token 为空，跳过'); process.exit(0); }

const [OWNER, NAME] = REPO.split('/');
const API = 'https://api.github.com';
const headers = {
  Authorization: `Bearer ${GH_PAT}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'User-Agent': 'reading-journal-sync',
  'X-GitHub-Api-Version': '2022-11-28',
};

(async () => {
  await sodium.ready;
  const pkRes = await fetch(`${API}/repos/${OWNER}/${NAME}/actions/secrets/public-key`, { headers });
  if (!pkRes.ok) { console.error('获取公钥失败:', pkRes.status); process.exit(1); }
  const { key_id, key } = await pkRes.json();
  const publicKey = Buffer.from(key, 'base64');
  const sealed = sodium.crypto_box_seal(Buffer.from(newToken, 'utf8'), publicKey);
  const encrypted_value = Buffer.from(sealed).toString('base64');

  const putRes = await fetch(`${API}/repos/${OWNER}/${NAME}/actions/secrets/${SECRET_NAME}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ encrypted_value, key_id }),
  });
  if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
    console.error('更新 Secret 失败:', putRes.status, await putRes.text());
    process.exit(1);
  }
  console.log(`✓ ${SECRET_NAME} 已自动更新（防轮换失效），长度 ${newToken.length}`);
})();
