# CloudflareDrive

基于 Cloudflare 免费层服务（Workers + D1 + R2）的个人云盘。前端使用 Vue 3 SPA，后端为 TypeScript/Hono Worker。认证由 Cloudflare Access 在边缘层处理，Worker 自身不实现认证逻辑。

> **其他语言 README**: [English](README.md) · [日本語](README.ja.md) · [Русский](README.ru.md)

---

## 功能

- 文件与文件夹管理：列表、创建、重命名、移动、复制、删除（软删除至回收站）
- 拖拽上传、上传队列与进度显示、**并行分片上传**（≥50MB 自动分片，5MB/片，4 路并发）
- **文件去重**：客户端 SHA-256 哈希，秒传已存在的文件（≤50MB）
- 单文件及分享文件夹下载
- 图片与文本预览
- **分享链接**：创建可设置过期时间的公开分享链接，浏览分享文件夹
- 回收站管理：恢复、永久删除、清空回收站、批量操作
- 按名称搜索文件
- 剪贴板操作（复制/剪切/粘贴）、多选、批量操作
- 右键菜单、键盘快捷键（Ctrl+A、Delete、F2、Enter、Ctrl+C/X/V）
- 按名称/大小/类型/日期排序、分页
- 深色/浅色模式切换、多语言界面（中文、英文、日文、俄文）
- 移动端适配

---

## 技术栈

| 层         | 技术                                                   |
| ---------- | ------------------------------------------------------ |
| 前端       | Vue 3 (Composition API, `<script setup>`) + TypeScript |
| UI 组件库  | Naive UI                                               |
| 状态管理   | Pinia                                                  |
| 后端运行时 | Cloudflare Workers                                     |
| 后端框架   | Hono                                                   |
| 数据库     | Cloudflare D1 (SQLite)                                 |
| 存储       | Cloudflare R2                                          |
| 认证       | Cloudflare Access (Zero Trust)                         |
| CLI 工具   | Wrangler                                               |
| 包管理器   | pnpm                                                   |
| 代码质量   | ESLint + Prettier + TypeScript strict                  |

---

## 架构

```
浏览器 (Vue 3 SPA)
    │
    │ HTTPS（通过 Cloudflare Access 认证）
    │
    ▼
Cloudflare Access（Zero Trust 边缘认证 — 未认证请求在此被拦截）
    │
    │ 仅认证后的请求到达 Worker
    │
    ▼
Cloudflare Worker (Hono API)
    │
    ├── R2 Bucket（文件内容）
    │
    └── D1 Database（元数据：文件、文件夹、分享链接）
```

### 设计决策

- **Worker 无认证逻辑** — Cloudflare Access 在边缘层处理所有认证。Worker 信任每个到达的请求为 Owner 操作
- **D1 仅存元数据** — 文件内容永不存入 D1；仅存储文件记录、文件夹层级、哈希索引和分享链接
- **R2 存储文件** — 文件以 `uploads/{uuid}/{fileName}` 路径存储；临时分片以 `temp/{uploadId}/{chunkIndex}` 存储，24h 后自动清理
- **文件去重范围**：全局（任何非回收站中具有相同哈希的文件），≤50MB 文件计算客户端 SHA-256
- **分片上传** 使用 `FixedLengthStream(totalSize)` 满足 R2 的内容长度要求，服务端流式组装
- **公开分享路由**（`/s/*`、`/api/v1/s/*`）需在 Cloudflare Access 中创建 Bypass 策略。`/assets/*` 也需要放行，因为 SPA 静态资源从此路径加载

---

## 目录结构

```
├── frontend/                  # Vue 3 SPA
│   ├── src/
│   │   ├── api/               # API 客户端
│   │   ├── components/        # 可复用组件
│   │   ├── composables/       # 组合式函数 (useUpload)
│   │   ├── i18n/              # 国际化翻译
│   │   ├── layouts/           # 布局组件
│   │   ├── pages/             # 路由页面
│   │   ├── router/            # 路由配置
│   │   ├── stores/            # Pinia 状态管理
│   │   ├── types/             # 类型定义
│   │   ├── utils/             # 工具函数
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   └── vite.config.ts
│
├── worker/                    # Cloudflare Worker 后端
│   ├── src/
│   │   ├── routes/            # 路由处理器
│   │   ├── services/          # 业务逻辑
│   │   ├── repositories/      # 数据访问层 (D1 + R2)
│   │   ├── types/             # Worker 类型和环境绑定
│   │   └── index.ts           # Worker 入口 + 定时任务
│   ├── migrations/            # D1 迁移脚本
│   └── wrangler.jsonc
│
├── .prettierrc
└── package.json               # 工作区根配置
```

---

## 前置要求

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)（通过工作区包含）
- [Cloudflare 账号](https://dash.cloudflare.com/)：
  - 已激活的域名（完整 DNS 接入）
  - 已开启 Workers、D1、R2
  - 已开启 Cloudflare Access (Zero Trust)

---

## 快速开始

### 1. 克隆并安装

```bash
git clone https://github.com/KangVin/CloudflareDrive.git && cd CloudflareDrive
pnpm install
```

### 2. 配置 Cloudflare 资源

```bash
# 创建 D1 数据库
wrangler d1 create cloudflare-drive-db

# 创建 R2 存储桶
wrangler r2 bucket create cloudflare-drive-storage
```

更新 `worker/wrangler.jsonc` 中的 D1 数据库 ID。

### 3. 应用数据库迁移

```bash
cd worker
wrangler d1 migrations apply cloudflare-drive-db --local   # 本地开发
wrangler d1 migrations apply cloudflare-drive-db --remote  # 生产环境
```

### 4. 配置 Cloudflare Access

在 Zero Trust → Access → Applications 中创建两个应用：

1. **主应用** — `drive.yourdomain.com` → 添加 Allow 策略（你的邮箱/域名）
2. **旁路应用** — `drive.yourdomain.com/s/*`、`drive.yourdomain.com/api/v1/s/*`、`drive.yourdomain.com/assets/*` → 添加 **Bypass** 策略（Include → Everyone）

### 5. 本地开发

```bash
# 终端 1：Worker
pnpm dev:worker   # 启动于 localhost:8787

# 终端 2：前端
pnpm dev:frontend # 启动于 localhost:5173，代理 /api 至 localhost:8787
```

### 6. 部署

```bash
# 构建前端
pnpm build:frontend

# 部署 Worker（通过 ASSETS 绑定包含前端文件）
cd worker
wrangler deploy
```

---

## API 端点

所有端点以 `/api/v1` 为前缀。

### 文件

| 方法     | 路径                                      | 说明                          |
| -------- | ----------------------------------------- | ----------------------------- |
| `GET`    | `/api/v1/files`                           | 列出根目录                    |
| `GET`    | `/api/v1/files?parentId={id}`             | 列出文件夹内容                |
| `GET`    | `/api/v1/files/search?q=`                 | 搜索文件                      |
| `GET`    | `/api/v1/files/by-hash?hash=`             | 通过 SHA-256 查找文件（去重） |
| `POST`   | `/api/v1/files/instant`                   | 秒传                          |
| `GET`    | `/api/v1/files/:id`                       | 获取文件/文件夹元数据         |
| `POST`   | `/api/v1/files`                           | 创建文件夹                    |
| `POST`   | `/api/v1/files/upload`                    | 上传文件（≤50MB）             |
| `POST`   | `/api/v1/files/upload/chunk`              | 上传分片                      |
| `POST`   | `/api/v1/files/upload/:uploadId/complete` | 完成分片上传                  |
| `POST`   | `/api/v1/files/:id/copy`                  | 复制文件/文件夹               |
| `PATCH`  | `/api/v1/files/:id`                       | 重命名/移动                   |
| `DELETE` | `/api/v1/files/:id`                       | 移入回收站                    |
| `GET`    | `/api/v1/files/:id/download`              | 下载文件                      |

### 回收站

| 方法     | 路径                        | 说明         |
| -------- | --------------------------- | ------------ |
| `GET`    | `/api/v1/trash`             | 列出回收站   |
| `DELETE` | `/api/v1/trash/:id`         | 永久删除     |
| `POST`   | `/api/v1/trash/:id/restore` | 从回收站恢复 |
| `POST`   | `/api/v1/trash/empty`       | 清空回收站   |

### 分享链接

| 方法     | 路径                                | 说明                     |
| -------- | ----------------------------------- | ------------------------ |
| `GET`    | `/api/v1/shares`                    | 列出分享链接             |
| `POST`   | `/api/v1/shares`                    | 创建分享链接             |
| `DELETE` | `/api/v1/shares/:id`                | 撤销分享链接             |
| `GET`    | `/api/v1/s/:token`                  | 公开访问（文件/文件夹）  |
| `GET`    | `/api/v1/s/:token/download`         | 公开下载分享文件         |
| `GET`    | `/api/v1/s/:token/download/:fileId` | 公开下载分享文件夹内文件 |

---

## 数据库结构

### `files`

| 列名         | 类型        | 说明                         |
| ------------ | ----------- | ---------------------------- |
| `id`         | TEXT (UUID) | 主键                         |
| `name`       | TEXT        | 文件或文件夹名称             |
| `parent_id`  | TEXT        | 父文件夹 ID（根目录为 NULL） |
| `type`       | TEXT        | `'file'` 或 `'folder'`       |
| `mime_type`  | TEXT        | MIME 类型（文件夹为 NULL）   |
| `size`       | INTEGER     | 文件大小（字节）             |
| `hash`       | TEXT        | SHA-256 哈希用于去重         |
| `r2_key`     | TEXT        | R2 对象键                    |
| `is_trashed` | INTEGER     | 0 = 正常，1 = 回收站         |
| `created_at` | TEXT        | ISO 8601 时间戳              |
| `updated_at` | TEXT        | ISO 8601 时间戳              |

### `shares`

| 列名         | 类型        | 说明                        |
| ------------ | ----------- | --------------------------- |
| `id`         | TEXT (UUID) | 主键                        |
| `file_id`    | TEXT        | 外键 → `files.id`           |
| `token`      | TEXT        | 唯一分享令牌                |
| `expires_at` | TEXT        | 过期时间（NULL = 永不过期） |
| `created_at` | TEXT        | ISO 8601 时间戳             |

---

## Cloudflare 免费层限制 (2026年)

- **Workers**：每日 10 万次请求
- **D1**：5 GB 存储，每月 500 万行读取，10 万行写入
- **R2**：10 GB 存储，每月 100 万次 Class A 操作，1000 万次 Class B 操作
- **Cloudflare Access**：最多 50 用户（免费版）

个人云盘通常不会超过这些限制。

---

## 许可证

本项目基于 Apache License, Version 2.0 许可。详见 [LICENSE](LICENSE) 文件。
