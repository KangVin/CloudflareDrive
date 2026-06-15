# CloudflareDrive

A personal cloud drive built on Cloudflare's free tier (Workers + D1 + R2), featuring a Vue 3 SPA frontend and a TypeScript/Hono Worker backend. All API requests are authenticated by Cloudflare Access at the edge — the Worker itself does not handle authentication.

> **READMEs in other languages**: [中文](README.zh.md) · [日本語](README.ja.md) · [Русский](README.ru.md)

---

## Features

- File & folder management: list, create, rename, move, copy, delete (soft delete with trash)
- Upload with drag-and-drop, upload queue with progress, **chunked parallel upload** (≥50MB automatically chunked into 5MB parts, 4 concurrent streams)
- **File deduplication**: client-side SHA-256 hashing, instant upload for files already on server (≤50MB)
- Download single files or from shared folders
- Image & text preview
- **Share links**: create expiring public share links with optional password protection for files or folders, browse shared folders
- Trash management: restore, permanent delete, empty trash, batch operations
- Search files by name
- Clipboard operations (copy/cut/paste), multi-select, batch actions
- Context menu, keyboard shortcuts (Ctrl+A, Delete, F2, Enter, Ctrl+C/X/V)
- Sorting by name/size/type/date, pagination
- Dark/light mode, multi-language UI (Chinese, English, Japanese, Russian)
- Mobile responsive

---

## Tech Stack

| Layer             | Technology                                             |
| ----------------- | ------------------------------------------------------ |
| Frontend          | Vue 3 (Composition API, `<script setup>`) + TypeScript |
| UI                | Naive UI                                               |
| State             | Pinia                                                  |
| Backend runtime   | Cloudflare Workers                                     |
| Backend framework | Hono                                                   |
| Database          | Cloudflare D1 (SQLite)                                 |
| Storage           | Cloudflare R2                                          |
| Authentication    | Cloudflare Access (Zero Trust)                         |
| CLI tooling       | Wrangler                                               |
| Package manager   | pnpm                                                   |
| Code quality      | ESLint + Prettier + TypeScript strict                  |

---

## Architecture

```
Browser (Vue 3 SPA)
    │
    │ HTTPS (through Cloudflare Access)
    │
    ▼
Cloudflare Access (Zero Trust edge auth — unauthenticated requests blocked here)
    │
    │ Only authenticated requests reach the Worker
    │
    ▼
Cloudflare Worker (Hono API)
    │
    ├── R2 Bucket (file content blobs)
    │
    └── D1 Database (metadata: files, folders, share links)
```

### Design Decisions

- **Zero auth logic in Worker** — Cloudflare Access handles all authentication at the edge. The Worker trusts every request it receives as an Owner operation.
- **D1 for metadata only** — file content never stored in D1; only file records, folder hierarchy, hash index, and share links.
- **R2 for blobs** — files stored at `uploads/{uuid}/{fileName}` via R2 native multipart upload. No server-side data assembly.
- **File dedup scope**: global (any non-trashed file with the same hash), client SHA-256 computed for files ≤50MB.
- **Chunked upload** (>50MB) uploads directly as parallel R2 multipart parts. `/complete` is a metadata-only operation (< 100ms).
- **Public share routes** (`/s/*`, `/api/v1/s/*`) must bypass Cloudflare Access via a Bypass policy with path selectors. `/assets/*` is also needed because SPA static resources load from that path.

---

## Directory Structure

```
├── frontend/                  # Vue 3 SPA
│   ├── src/
│   │   ├── api/               # API client modules
│   │   ├── components/        # Reusable UI components
│   │   ├── composables/       # Vue composables (useUpload)
│   │   ├── i18n/              # i18n translation resources
│   │   ├── layouts/           # Layout components
│   │   ├── pages/             # Route pages
│   │   ├── router/            # Vue Router config
│   │   ├── stores/            # Pinia stores
│   │   ├── types/             # Shared type definitions
│   │   ├── utils/             # Utility functions
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   └── vite.config.ts
│
├── worker/                    # Cloudflare Worker backend
│   ├── src/
│   │   ├── routes/            # Route handlers (files, trash, shares)
│   │   ├── services/          # Business logic
│   │   ├── repositories/      # Data access (D1 + R2)
│   │   ├── types/             # Worker types & env bindings
│   │   └── index.ts           # Worker entry + scheduled cron
│   ├── migrations/            # D1 migrations
│   └── wrangler.jsonc
│
├── .prettierrc
└── package.json               # Root workspace
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (included via workspace)
- A [Cloudflare account](https://dash.cloudflare.com/) with:
  - An active domain on Cloudflare (full setup)
  - Cloudflare Workers enabled
  - D1 and R2 enabled
  - Cloudflare Access (Zero Trust) enabled

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/KangVin/CloudflareDrive.git && cd CloudflareDrive
pnpm install
```

### 2. Configure Cloudflare resources

```bash
# Create D1 database
wrangler d1 create cloudflare-drive-db

# Create R2 bucket
wrangler r2 bucket create cloudflare-drive-storage
```

Update `worker/wrangler.jsonc` with your D1 database ID.

### 3. Apply database migrations

```bash
cd worker
wrangler d1 migrations apply cloudflare-drive-db --local   # local dev
wrangler d1 migrations apply cloudflare-drive-db --remote  # production
```

### 4. Configure Cloudflare Access

Create two Access applications in Zero Trust → Access → Applications:

1. **Main app** — `drive.yourdomain.com` → Add an Allow policy for your email/domain
2. **Bypass app** — `drive.yourdomain.com/s/*`, `drive.yourdomain.com/api/v1/s/*`, `drive.yourdomain.com/assets/*` → Add a **Bypass** policy with Include → Everyone

### 5. Local development

```bash
# Terminal 1: Worker
pnpm dev:worker   # starts at localhost:8787

# Terminal 2: Frontend
pnpm dev:frontend # starts at localhost:5173, proxies /api to localhost:8787
```

### 6. Set share link password secret

```bash
# Local development
cd worker
wrangler secret put SHARED_SECRET --local

# Production
wrangler secret put SHARED_SECRET
```

This secret is used to sign and verify tokens for password-protected share links. Generate a random 64-character string. If not set, a hardcoded fallback is used for local dev only — **you must set this in production**.

### 7. Deploy

```bash
# Build frontend
pnpm build:frontend

# Deploy worker (includes frontend assets via ASSETS binding)
cd worker
wrangler deploy
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Files

| Method   | Path                            | Description                       |
| -------- | ------------------------------- | --------------------------------- |
| `GET`    | `/api/v1/files`                 | List root directory               |
| `GET`    | `/api/v1/files?parentId={id}`   | List folder contents              |
| `GET`    | `/api/v1/files/search?q=`       | Search files                      |
| `GET`    | `/api/v1/files/by-hash?hash=`   | Find file by SHA-256 hash (dedup) |
| `POST`   | `/api/v1/files/instant`         | Instant upload from existing hash |
| `GET`    | `/api/v1/files/:id`             | Get file/folder metadata          |
| `POST`   | `/api/v1/files`                 | Create folder                     |
| `POST`   | `/api/v1/files/upload`          | Upload file (≤50MB)               |
| `POST`   | `/api/v1/files/upload/create`   | Create multipart upload           |
| `POST`   | `/api/v1/files/upload/part`     | Upload a single multipart part    |
| `POST`   | `/api/v1/files/upload/complete` | Complete multipart upload         |
| `POST`   | `/api/v1/files/:id/copy`        | Copy file/folder                  |
| `PATCH`  | `/api/v1/files/:id`             | Rename/move file/folder           |
| `DELETE` | `/api/v1/files/:id`             | Move to trash                     |
| `GET`    | `/api/v1/files/:id/download`    | Download file                     |

### Trash

| Method   | Path                        | Description        |
| -------- | --------------------------- | ------------------ |
| `GET`    | `/api/v1/trash`             | List trashed files |
| `DELETE` | `/api/v1/trash/:id`         | Permanently delete |
| `POST`   | `/api/v1/trash/:id/restore` | Restore from trash |
| `POST`   | `/api/v1/trash/empty`       | Empty trash        |

### Share Links

| Method   | Path                                | Description                                 |
| -------- | ----------------------------------- | ------------------------------------------- |
| `GET`    | `/api/v1/shares`                    | List share links                            |
| `POST`   | `/api/v1/shares`                    | Create share link (supports `password`)     |
| `DELETE` | `/api/v1/shares/:id`                | Revoke share link                           |
| `POST`   | `/api/v1/s/:token/verify`           | Verify share password → `verify_token`      |
| `GET`    | `/api/v1/s/:token`                  | Public access (file/folder)                 |
| `GET`    | `/api/v1/s/:token/browse/:folderId` | Browse subfolder in shared folder           |
| `GET`    | `/api/v1/s/:token/download`         | Public file download (supports `?vt=`)      |
| `GET`    | `/api/v1/s/:token/download/:fileId` | Public download from shared folder (`?vt=`) |

> Password-protected shares require a `X-Verify-Token` header (or `?vt=` query param for downloads) obtained from `POST /verify`.

---

## Database Schema

### `files`

| Column       | Type        | Description                        |
| ------------ | ----------- | ---------------------------------- |
| `id`         | TEXT (UUID) | Primary key                        |
| `name`       | TEXT        | File or folder name                |
| `parent_id`  | TEXT        | Parent folder ID (NULL = root)     |
| `type`       | TEXT        | `'file'` or `'folder'`             |
| `mime_type`  | TEXT        | MIME type (NULL for folders)       |
| `size`       | INTEGER     | File size in bytes (0 for folders) |
| `hash`       | TEXT        | SHA-256 hash for dedup             |
| `r2_key`     | TEXT        | R2 object key (NULL for folders)   |
| `is_trashed` | INTEGER     | 0 = active, 1 = trashed            |
| `created_at` | TEXT        | ISO 8601 timestamp                 |
| `updated_at` | TEXT        | ISO 8601 timestamp                 |

### `shares`

| Column          | Type        | Description                           |
| --------------- | ----------- | ------------------------------------- |
| `id`            | TEXT (UUID) | Primary key                           |
| `file_id`       | TEXT        | Foreign key → `files.id`              |
| `token`         | TEXT        | Unique share token (URL-safe)         |
| `expires_at`    | TEXT        | Expiration (NULL = never)             |
| `created_at`    | TEXT        | ISO 8601 timestamp                    |
| `password_hash` | TEXT        | SHA-256 hash (NULL = no password)     |
| `password_salt` | TEXT        | Random UUID salt (NULL = no password) |

---

## Cloudflare Free Tier Limits (as of 2026)

- **Workers**: 100,000 requests/day
- **D1**: 5 GB storage, 5M rows read/month, 100K rows written/month
- **R2**: 10 GB storage, 1M Class A ops/month, 10M Class B ops/month
- **Cloudflare Access**: up to 50 users (free plan)

A personal cloud drive typically stays well within these limits.

---

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
