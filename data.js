// 模拟数据：结构与飞书多维表格字段对齐。
// 真实接入时，loadData() 会改为从 Serverless 代理（Feishu OpenAPI）拉取同结构的 JSON。
const BOOKS = [
  {
    id: 1,
    title: "人类简史",
    author: "尤瓦尔·赫拉利",
    status: "读完",
    rating: 4,
    tags: ["历史", "人类学"],
    year: 2026,
    date: "2026-03-12",
    color: "#C46A4A",
    excerpt: "从认知革命到科学革命，重新审视人类如何成为地球的主宰。",
    notes: "智人之所以胜出，不是因为更强壮，而是因为能够编织「虚构故事」——货币、宗教、国家皆是如此。这本书最让我震撼的，是它把熟悉的一切都还原成了「偶然」。",
    quotes: [
      "我们以为自己驯化了小麦，其实是小麦驯化了我们。",
      "大规模合作的基础，从来不是客观真相，而是共同相信的虚构。"
    ]
  },
  {
    id: 2,
    title: "置身事内",
    author: "兰小欢",
    status: "读完",
    rating: 4,
    tags: ["经济", "随笔"],
    year: 2025,
    date: "2025-11-02",
    color: "#3E6B5E",
    excerpt: "理解中国经济，要从地方政府的投融资讲起。",
    notes: "财政与债务，是这本书最锋利的一条线。作者把宏观叙事拉回到县乡一级的具体权衡，读起来像在听一位务实的同僚拆解棋局。",
    quotes: [
      "经济政策从来不是抽象的数字，而是一次次具体的取舍。"
    ]
  },
  {
    id: 3,
    title: "三体",
    author: "刘慈欣",
    status: "在读",
    rating: 5,
    tags: ["科幻", "小说"],
    year: 2026,
    date: "2026-06-20",
    color: "#2F4A6B",
    excerpt: "给岁月以文明，而不是给文明以岁月。",
    notes: "读到「黑暗森林」那一段时，把书放下了很久。宇宙社会学的前提冷酷得让人清醒：生存是文明的第一需要。",
    quotes: [
      "弱小和无知不是生存的障碍，傲慢才是。",
      "给岁月以文明，而不是给文明以岁月。"
    ]
  },
  {
    id: 4,
    title: "被讨厌的勇气",
    author: "岸见一郎 / 古贺史健",
    status: "读完",
    rating: 4,
    tags: ["心理", "哲学"],
    year: 2025,
    date: "2025-08-15",
    color: "#B58A3C",
    excerpt: "一切烦恼都来自人际关系，而自由就是被别人讨厌。",
    notes: "阿德勒的「课题分离」像一把刀，干脆地切开了很多自我感动式的纠结。书是对话体，读着轻松，想起来却沉。",
    quotes: [
      "人不是因为环境而改变的，而是因为赋予了环境意义才改变的。"
    ]
  },
  {
    id: 5,
    title: "活着",
    author: "余华",
    status: "读完",
    rating: 5,
    tags: ["小说", "文学"],
    year: 2024,
    date: "2024-12-30",
    color: "#8A4B4B",
    excerpt: "人是为活着本身而活着，而不是为了活着之外的任何事物。",
    notes: "薄薄一本，读完却像走完了一生。福贵失去一切却还坐在田埂上，那种平静比悲怆更有力量。",
    quotes: [
      "人是为活着本身而活着的，而不是为了活着之外的任何事物而活着。"
    ]
  },
  {
    id: 6,
    title: "沉思录",
    author: "马可·奥勒留",
    status: "想读",
    rating: 0,
    tags: ["哲学", "古典"],
    year: 2026,
    date: "2026-07-01",
    color: "#5B6B7A",
    excerpt: "你拥有支配自己内心的力量，而非支配外界。",
    notes: "",
    quotes: []
  },
  {
    id: 7,
    title: "设计中的设计",
    author: "原研哉",
    status: "在读",
    rating: 4,
    tags: ["设计", "随笔"],
    year: 2026,
    date: "2026-05-09",
    color: "#6B6256",
    excerpt: "设计不是制造新奇，而是唤醒对日常的觉察。",
    notes: "原研哉谈「空」与「白」时，让人重新看了一遍身边的器物。做网页也该如此：留白不是没内容，而是给内容呼吸。",
    quotes: [
      "设计是一种教养，是对生活的重新发现。"
    ]
  },
  {
    id: 8,
    title: "枪炮、病菌与钢铁",
    author: "贾雷德·戴蒙德",
    status: "读完",
    rating: 5,
    tags: ["历史", "人类学"],
    year: 2024,
    date: "2024-09-18",
    color: "#7A6A3A",
    excerpt: "为何是欧亚大陆征服了世界，而非相反？答案写在地理里。",
    notes: "把文明差异归因于环境而非种族，这本书的格局很大。读完会对「命运」二字有另一种理解。",
    quotes: [
      "历史并不遵循某条预定轨道，它只是沿着地理给定的约束滑行。"
    ]
  },
  {
    id: 9,
    title: "心流",
    author: "米哈里·契克森米哈赖",
    status: "想读",
    rating: 0,
    tags: ["心理", "幸福"],
    year: 2026,
    date: "2026-07-10",
    color: "#4A6B6B",
    excerpt: "幸福不是得到什么，而是全身心投入某事时的状态。",
    notes: "",
    quotes: []
  }
];

// 数据接入：优先本地实时接口 /api/books（Node 服务），
// 失败则回退静态 data/books.json（GitHub Pages 等纯静态托管），
// 再不行才用内置模拟数据兜底。
async function loadData() {
  // 1) 本地 Node 服务实时拉取（server.mjs 提供）
  try {
    const res = await fetch('/api/books', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (!json.error && json.books) {
        console.log(`📖 从飞书实时加载了 ${json.books.length} 本书（来源: ${json.source}）`);
        return json.books;
      }
    }
  } catch (e) { console.warn('本地 /api/books 不可用，尝试静态 JSON:', e.message); }

  // 2) 静态 JSON（GitHub Actions 定时生成并提交）
  try {
    const res = await fetch('data/books.json', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.books) {
        console.log(`📖 从静态 data/books.json 加载了 ${json.books.length} 本书`);
        return json.books;
      }
    }
  } catch (e) { console.warn('静态 JSON 也不可用:', e.message); }

  // 3) 兜底模拟数据
  console.warn('⚠️ 全部数据源不可用，使用内置模拟数据');
  return BOOKS;
}
