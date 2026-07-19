# 读书手帐 · GitHub Pages 托管指引（保姆级）

把你的飞书读书笔记网站部署到 GitHub，免费、自动同步、全球可访问。
全程不用写代码、不用买服务器。按步骤点就行。

---

## 先搞清楚两套「同步」的区别

| 方式 | 你现在本地 `localhost:8080` | 部署到 GitHub Pages 后 |
|---|---|---|
| 怎么读数据 | Node 服务实时调飞书（`/api/books`） | GitHub 机器人每 30 分钟拉一次飞书，生成 `data/books.json` 提交到仓库 |
| 改了飞书多久同步 | 刷新后约 5 分钟内（但 2 小时后需重新授权） | 最多 30 分钟自动同步；也可手动点一下立即同步 |
| 稳定性 | 依赖本地电脑开着、token 不失效 | 全自动，不用管 |

**结论**：部署到 GitHub 后，你在飞书写笔记 → 最多 30 分钟网页自动更新，**比现在本地还省心**。

---

## 第 1 步：注册 / 登录 GitHub

1. 打开 https://github.com
2. 点右上角 **Sign up** 注册（用邮箱，几分钟搞定）；已有账号直接 **Sign in**。
3. 登录后进入主页。

---

## 第 2 步：新建一个仓库（Repository）

1. 右上角头像旁边点 **「+」** → 选 **「New repository」**。
2. 填这几项：
   - **Repository name（仓库名）**：随便起，比如 `reading-journal`（只能英文/数字/连字符）。记下来，后面网址要用。
   - **Description**：可填「我的读书手帐」。
   - **Visibility**：选 **Public**（私有仓库的 Pages 要付费，选 Public 免费）。
   - 不要勾任何 "Add a README / .gitignore" 初始化选项（我们本地已经有文件了）。
3. 点底部 **「Create repository」**。
4. 创建后页面会显示一个空仓库，并给出一串 git 地址，长这样：
   `https://github.com/你的用户名/reading-journal.git`
   复制备用（下面第 5 步用）。

---

## 第 3 步：把本地这些文件放进仓库

工作区里**已经为你准备好全部文件**了。你需要把它们提交到 git。
（如果你不熟悉命令行，我也可以帮你直接在这里操作——告诉我即可。）

要提交的文件清单（这些我已经在工作区放好了）：

```
index.html              网页主文件
styles.css             样式
app.js                 交互逻辑
data.js                数据加载（先试实时接口，失败回退静态 JSON）
feishu_data.mjs        飞书取数核心模块
build_data.mjs         生成 data/books.json 的脚本
.github/workflows/sync.yml   GitHub 自动同步工作流
data/books.json        飞书数据快照（已生成）
covers/                封面图片（已下载）
.gitignore             忽略 .env 等敏感文件
```

**千万不要提交**：`.env` 和 `.user_token.json`（含你的飞书密钥，已在 `.gitignore` 里排除）。

在终端（工作区目录）执行：

```bash
git init
git add .
git commit -m "读书手帐网站：飞书实时同步 + GitHub Pages"
```

> 如果提示要设置邮箱/用户名，先执行：
> `git config --global user.email "你的邮箱"` 和 `git config --global user.name "你的名字"`

---

## 第 4 步：推送到 GitHub

把第 2 步复制的地址粘进来（换成你自己的）：

```bash
git branch -M main
git remote add origin https://github.com/你的用户名/reading-journal.git
git push -u origin main
```

推送成功后，刷新 GitHub 仓库页面，应该能看到这些文件都在了。

---

## 第 5 步：配置三个「秘密」（Secrets）

这一步是把飞书凭证安全地交给 GitHub 机器人（**不会泄露在代码里**）。

1. 在仓库页面，点顶部 **「Settings」**（设置）。
2. 左侧栏滚到最下面，点 **「Secrets and variables」→「Actions」**。
3. 点绿色按钮 **「New repository secret」**，依次添加三个：

| Name（名称，照抄） | Secret 值（去哪里拿） |
|---|---|
| `FEISHU_APP_ID` | 飞书开放平台 →「读书手帐」→ 凭证与基础信息 → `cli_aad...` 那串 |
| `FEISHU_APP_SECRET` | 同页面里点「查看」复制的 App Secret |
| `FEISHU_REFRESH_TOKEN` | 工作区里的 `.user_token.json` 文件，打开后找到 `"refresh_token"` 后面那串长字符（约 1600 字符） |

   每个都填 Name + Secret，点 **「Add secret」**。三个都加完，列表里应出现这三项。

> ⚠️ `FEISHU_REFRESH_TOKEN` 是让机器人**免登录**自动续期的关键。它长期有效，但如果你在飞书里删了应用或重置了凭证，需要重新走一次本地 OAuth 拿新 token、再回来更新这个 Secret。

---

## 第 6 步：开启 GitHub Pages

1. 仓库页面点 **「Settings」** → 左侧 **「Pages」**。
2. **Build and deployment** 区域：
   - Source（来源）选 **「Deploy from a branch」**（从分支部署）。
   - Branch（分支）选 **`main`**，目录选 **`/ (root)`**。
   - 点 **「Save」**。
3. 等 1～2 分钟，页面顶部会显示：
   `Your site is published at https://你的用户名.github.io/reading-journal/`
   这就是你网站的公开地址，发给谁都能看。

---

## 第 7 步：立刻同步一次（可选但推荐）

GitHub 机器人默认每 30 分钟跑一次。想马上看到效果：

1. 仓库页面点顶部 **「Actions」**。
2. 左侧应看到工作流 **「Sync Feishu → books.json」**。
3. 点它 → 右侧 **「Run workflow」** → 再次 **「Run workflow」**。
4. 等约 20～40 秒，出现绿色 ✓ 即成功（它会自动拉飞书、生成数据、提交）。

---

## 第 8 步：验证

打开第 6 步拿到的网址：`https://你的用户名.github.io/reading-journal/`
应看到《资本主义没告诉你的 23 件事》等真实笔记，封面、三视图、复制按钮都正常。

---

## 以后怎么用

- **你在飞书写 / 改笔记** → 最多 30 分钟，网页自动更新（机器人定时跑）。
- **想立刻更新** → 去 Actions 点一次「Run workflow」即可。
- **换电脑 / 重装** → 不用重来，GitHub 上都有；本地只用 `git clone` 下来继续改前端。
- **改网站外观** → 改 `styles.css` / `app.js` 后，`git add . && git commit && git push`，Pages 自动重新发布。

---

## 常见排查

| 现象 | 原因 / 解决 |
|---|---|
| 网页空白或显示模拟数据 | `data/books.json` 没生成。去 Actions 看是否报错；多半是 Secrets 填错 |
| 报 `refresh_token` 无效 | token 过期/被重置。本地重跑 `oauth_server.mjs` 拿新 `.user_token.json`，更新 `FEISHU_REFRESH_TOKEN` Secret |
| 封面不显示 | 检查 `covers/` 目录是否随仓库提交；或重跑一次 Action |
| 网址 404 | Pages 还没建好（等 1~2 分钟），或分支/目录选错（应 main / root） |
| 改了飞书 30 分钟没变 | 机器人可能正在跑或被限流，去 Actions 手动 Run 一次 |

---

## 一句话总结

代码已就绪 → 建仓库 → `git push` → 配 3 个 Secret → 开 Pages → 点一次 Run workflow → 拿到公开网址，之后飞书改完自动同步。
