# AI Radar

全球 AI 资讯聚合与可视化平台，帮助 AI 从业者在 3 分钟内了解过去 24 小时最重要的 AI 动态。

## 技术栈

- **前端**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **数据库**: Supabase (PostgreSQL)
- **LLM**: Generic provider layer (Anthropic + OpenAI-compatible endpoints such as DashScope)
- **部署**: Vercel + Vercel Cron Jobs

## 数据源覆盖 (26个)

**官方**: OpenAI · Anthropic · Google DeepMind · Google AI · Meta AI · xAI · Mistral · NVIDIA · Hugging Face

**社区/平台**: Hacker News · arXiv · Papers with Code · GitHub Trending · Hugging Face Trending

**高信号个人**: Karpathy · swyx · Hamel Husain · Lenny Rachitsky · Harrison Chase (LangChain) · Guillermo Rauch · Sam Altman* · Yann LeCun* · Demis Hassabis* · Amjad Masad*

**媒体**: MIT Technology Review · TechCrunch AI · VentureBeat AI

> *需要 Twitter API Bearer Token

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env.local
# 填入以下必要变量：
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# LLM_API_KEY
# LLM_BASE_URL
# CRON_SECRET
```

### 2. 初始化 Supabase 数据库

在 Supabase SQL Editor 中执行：

```
supabase/migrations/001_init.sql
supabase/migrations/004_model_rankings.sql
```

### 3. 安装依赖和启动

```bash
npm install
npm run dev
```

### E2E 前端测试（Playwright）

```bash
# 先 build，再跑 e2e（会自动起 next start）
npm run build
npm run test:e2e
```

### 4. 手动触发首次抓取

```bash
# 启动后，手动触发一次完整流程（需要在 Supabase 设置好后）：
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/crawl
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/process
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/digest
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/rankings
```

## 部署到 Vercel

1. 推送代码到 GitHub
2. 在 Vercel 导入项目
3. 配置所有环境变量
4. `vercel.json` 中的 Cron Jobs 会自动生效：
   - **每 3 小时**: 抓取新资讯
   - **每 1 小时**: LLM 处理待处理文章
   - **每天 8:00**: 生成每日简报
   - **每 12 小时**: 更新模型排行榜（公开榜单聚合）

## 项目结构

```
ai-radar/
├── app/
│   ├── page.tsx              # Dashboard 首页
│   ├── DashboardClient.tsx   # 客户端交互
│   ├── models/               # 模型排行榜页
│   ├── digest/
│   │   ├── page.tsx          # 简报列表
│   │   └── [date]/page.tsx   # 简报详情
│   └── api/
│       ├── cron/crawl/       # 爬取 Cron
│       ├── cron/process/     # 处理 Cron
│       ├── cron/digest/      # 简报 Cron
│       ├── cron/rankings/    # 模型排行 Cron
│       ├── articles/         # 文章查询 API
│       └── digest/           # 简报 API
├── components/               # UI 组件
├── lib/
│   ├── crawlers/             # 爬虫实现
│   ├── processor/            # LLM 处理
│   ├── supabase.ts
│   └── types.ts
└── supabase/migrations/      # DB Schema
```

## LLM 处理输出

每篇文章经过 Claude 处理后生成：

| 字段 | 说明 |
|------|------|
| `summary_zh` | 2-3句中文摘要 |
| `category` | 8类之一（模型发布/产品工具/研究论文等）|
| `tags` | 最多8个标签 |
| `importance_score` | 1-10分重要性（10=行业级事件）|
| `why_it_matters` | 一句话核心洞察 |

## LLM 配置

项目现在统一使用一组共享 LLM 配置：

```bash
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.anthropic.com
```

- `process` 和 `digest` 共用同一组 `key/url`
- 默认不要求配置模型名
- 如需覆盖默认模型，可额外设置 `LLM_MODEL`

### 常见示例

**Anthropic 官方**

```bash
LLM_API_KEY=sk-ant-...
LLM_BASE_URL=https://api.anthropic.com
```

**阿里云百炼（OpenAI 兼容接口）**

```bash
LLM_API_KEY=your-dashscope-key
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

> 兼容说明：代码优先读取 `LLM_*`；如果未设置，会回退兼容旧的 `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL`。

## GitHub Actions Secrets

GitHub Actions 建议配置以下 secrets：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`（可选）

现有 workflow 已兼容旧 secrets 名称 `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL`，方便平滑迁移。

## Twitter API 设置（可选）

监控 Sam Altman、Yann LeCun、Demis Hassabis、Amjad Masad 需要 Twitter API：

1. 申请 [Twitter Developer App](https://developer.twitter.com/en/apps)
2. 获取 Bearer Token
3. 添加到环境变量：`TWITTER_BEARER_TOKEN=...`
