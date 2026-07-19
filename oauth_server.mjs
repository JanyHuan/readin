import http from 'http';
import { readFileSync, writeFileSync } from 'fs';
import { URL } from 'url';

const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const CLIENT_ID = env.FEISHU_APP_ID;
const CLIENT_SECRET = env.FEISHU_APP_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const PORT = 3000;

const SCOPES = [
  'wiki:wiki:readonly',
  'drive:drive:readonly',
  'bitable:app:readonly',
  'offline_access',
].join(' ');

console.log('CLIENT_ID:', CLIENT_ID);
console.log('SCOPES:', SCOPES);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  console.log('\nREQ:', u.pathname + (u.search || '').slice(0, 80));

  if (u.pathname === '/callback') {
    const code = u.searchParams.get('code');
    const err = u.searchParams.get('error');
    console.log('code:', code?.slice(0, 8));
    console.log('error:', err);

    if (err) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h2>❌ 授权被拒绝</h2><p>${err}</p>`);
      return;
    }
    if (!code) {
      res.writeHead(400);
      res.end('<h2>❌ 缺少 code</h2>');
      return;
    }

    try {
      // v2 OAuth token endpoint
      const r = await fetch(
        'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI,
          }),
        }
      );
      const text = await r.text();
      let j;
      try { j = JSON.parse(text); } catch { j = { raw: text }; }
      
      // Log full response for debugging
      console.log('TOKEN_RESP status=' + r.status);
      console.log('TOKEN_RESP body=' + text.slice(0, 500));
      console.log('TOKEN_RESP keys=', Object.keys(j));

      if (j.code !== undefined && j.code !== 0) throw new Error(text.slice(0, 400));

      // v2 endpoint may return tokens at top level or in j.data
      const data = j.data || j;
      const { access_token, refresh_token, expires_in, scope } = data;

      if (!access_token) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>⚠️ 拿到响应但解析不到 token</h2><pre>${text}</pre><p>请把此页截图发给 WorkBuddy。</p>`);
        return;
      }

      writeFileSync(
        '.user_token.json',
        JSON.stringify({ access_token, refresh_token, expires_in, scope, got_at: Date.now() }, null, 2)
      );
      console.log('✅ TOKEN SAVED! scope=' + (scope||'?'));

      // 测 wiki
      const wr = await fetch(
        'https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=Q9mpwzBnhiaf0wknkvVcupzvnuQ',
        { headers: { Authorization: 'Bearer ' + access_token } }
      );
      const wj = await wr.json();
      console.log('WIKI code=' + wj.code);

      let html;
      if (wj.code === 0) {
        const n = wj.data.node;
        html = `<h2 style="padding:40px;font-family:sans-serif">✅ 全部打通！</h2>
<table style="padding:20px"><tr><td>Wiki 类型</td><td>${n.obj_type}</td></tr>
<tr><td>Token</td><td>${n.obj_token}</td></tr>
<tr><td>Scope</td><td><code>${scope}</code></td></tr></table>
<p style="color:#888;padding:20px">回到 WorkBuddy 对话继续，关掉此页。</p>`;
      } else {
        html = `<h2 style="padding:40px;font-family:sans-serif">⚠️ Token OK，Wiki 报 ${wj.code}</h2>
<pre style="background:#f5f5f5;padding:16px">${JSON.stringify(wj,null,2)}</pre>
<p>截图发回 WorkBuddy 继续排查。</p>`;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      server.close();
    } catch (e) {
      console.error('ERR:', e.message?.slice(0, 200));
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>❌ 失败</h2><pre>' + String(e.message) + '</pre>');
    }
    return;
  }

  if (u.pathname === '/') {
    const authUrl =
      'https://accounts.feishu.cn/open-apis/authen/v1/authorize' +
      '?client_id=' + CLIENT_ID +
      '&response_type=code&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
      '&scope=' + encodeURIComponent(SCOPES) +
      '&state=reading-site';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;max-width:640px;margin:60px auto;color:#333}
a{display:inline-block;background:#1d6eff;color:#fff;padding:14px 30px;border-radius:8px;text-decoration:none;font-size:17px}
a:hover{background:#1556c7}</style>
</head><body>
<h2>🔑 飞书授权</h2><p>点击下方按钮授权：</p><br>
<a href="${authUrl}" target="_blank">📖 授权知识库 &amp; 多维表格</a>
<br><br><p style="color:#888;font-size:13px">scope: ${SCOPES.replace(/ /g, ' → ')}</p>
</body></html>`);
    return;
  }
  res.writeHead(404).end('not found');
});

server.listen(PORT, () => {
  console.log(`\n✅ Running on http://localhost:${PORT}\n`);
});
