# CloudflareDrive

Cloudflare の無料枠（Workers + D1 + R2）を活用した個人向けクラウドドライブです。フロントエンドは Vue 3 SPA、バックエンドは TypeScript/Hono の Worker で構成されています。認証は Cloudflare Access がエッジで処理し、Worker 自体は認証ロジックを持ちません。

> **他の言語の README**: [English](README.md) · [中文](README.zh.md) · [Русский](README.ru.md)

---

## 機能

- ファイル・フォルダ管理：一覧表示、作成、名前変更、移動、コピー、削除（ゴミ箱へのソフトデリート）
- ドラッグ＆ドロップアップロード、アップロードキューと進捗表示、**並列チャンクアップロード**（50MB以上は自動で5MBチャンクに分割、4並列）
- **ファイル重複排除**：クライアント側SHA-256ハッシュ計算、既存ファイルの瞬時アップロード（50MB以下）
- 単一ファイルおよび共有フォルダからのダウンロード
- 画像・テキストプレビュー
- **共有リンク**：有効期限付きの公開共有リンクを作成、共有フォルダの閲覧
- ゴミ箱管理：復元、完全削除、ゴミ箱を空にする、バッチ操作
- ファイル名検索
- クリップボード操作（コピー/切り取り/貼り付け）、複数選択、バッチ操作
- コンテキストメニュー、キーボードショートカット（Ctrl+A、Delete、F2、Enter、Ctrl+C/X/V）
- 名前/サイズ/種類/日付での並び替え、ページネーション
- ダーク/ライトモード、多言語UI（中国語、英語、日本語、ロシア語）
- モバイル対応

---

## 技術スタック

| 層             | 技術                                                   |
| -------------- | ------------------------------------------------------ |
| フロントエンド | Vue 3 (Composition API, `<script setup>`) + TypeScript |
| UI             | Naive UI                                               |
| 状態管理       | Pinia                                                  |
| バックエンド   | Cloudflare Workers                                     |
| バックエンドFW | Hono                                                   |
| データベース   | Cloudflare D1 (SQLite)                                 |
| ストレージ     | Cloudflare R2                                          |
| 認証           | Cloudflare Access (Zero Trust)                         |
| CLI ツール     | Wrangler                                               |
| パッケージ管理 | pnpm                                                   |
| コード品質     | ESLint + Prettier + TypeScript strict                  |

---

## アーキテクチャ

```
ブラウザ (Vue 3 SPA)
    │
    │ HTTPS（Cloudflare Access 経由）
    │
    ▼
Cloudflare Access（Zero Trust エッジ認証 — 未認証リクエストはここでブロック）
    │
    │ 認証済みリクエストのみ Worker に到達
    │
    ▼
Cloudflare Worker (Hono API)
    │
    ├── R2 Bucket（ファイルコンテンツ）
    │
    └── D1 Database（メタデータ：ファイル、フォルダ、共有リンク）
```

### 設計判断

- **Worker に認証ロジックなし** — Cloudflare Access がエッジで全認証を処理。Worker は全てのリクエストを Owner 操作として信頼
- **D1 はメタデータのみ** — ファイルコンテンツは D1 に保存せず、ファイルレコード、フォルダ階層、ハッシュインデックス、共有リンクのみ
- **R2 にファイル保存** — ファイルは `uploads/{uuid}/{fileName}` に保存。一時チャンクは `temp/{uploadId}/{chunkIndex}` に保存され、24時間後に自動削除
- **重複排除範囲**: グローバル（同じハッシュを持つゴミ箱以外のファイル）、50MB以下のファイルでクライアントSHA-256ハッシュを計算
- **チャンクアップロード**は `FixedLengthStream(totalSize)` を使用してR2のコンテンツ長要件を満たし、サーバー側でストリームを結合
- **公開共有ルート**（`/s/*`、`/api/v1/s/*`）は Cloudflare Access で Bypass ポリシーを設定する必要があります。SPAの静的リソースが `/assets/*` から読み込まれるため、これもバイパス対象に含める必要があります

---

## ディレクトリ構造

```
├── frontend/                  # Vue 3 SPA
│   ├── src/
│   │   ├── api/               # API クライアント
│   │   ├── components/        # 再利用可能なUIコンポーネント
│   │   ├── composables/       # Vue コンポーザブル (useUpload)
│   │   ├── i18n/              # 国際化翻訳リソース
│   │   ├── layouts/           # レイアウトコンポーネント
│   │   ├── pages/             # ルートページ
│   │   ├── router/            # Vue Router 設定
│   │   ├── stores/            # Pinia ストア
│   │   ├── types/             # 共有型定義
│   │   ├── utils/             # ユーティリティ関数
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   └── vite.config.ts
│
├── worker/                    # Cloudflare Worker バックエンド
│   ├── src/
│   │   ├── routes/            # ルートハンドラ
│   │   ├── services/          # ビジネスロジック
│   │   ├── repositories/      # データアクセス (D1 + R2)
│   │   ├── types/             # Worker 型と環境バインディング
│   │   └── index.ts           # Worker エントリ + cron
│   ├── migrations/            # D1 マイグレーション
│   └── wrangler.jsonc
│
├── .prettierrc
├── AGENTS.md                  # AI アシスタント向け指示
├── Plans.md                   # プロジェクト計画（中国語）
└── package.json               # ルートワークスペース
```

---

## 前提条件

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)（ワークスペースに含まれています）
- [Cloudflare アカウント](https://dash.cloudflare.com/)：
  - Cloudflare 上でアクティブなドメイン（フルセットアップ）
  - Workers、D1、R2 が有効
  - Cloudflare Access (Zero Trust) が有効

---

## クイックスタート

### 1. クローン & インストール

```bash
git clone https://github.com/KangVin/CloudflareDrive.git && cd CloudflareDrive
pnpm install
```

### 2. Cloudflare リソースの設定

```bash
# D1 データベースの作成
wrangler d1 create cloudflare-drive-db

# R2 バケットの作成
wrangler r2 bucket create cloudflare-drive-storage
```

`worker/wrangler.jsonc` の D1 データベース ID を更新してください。

### 3. データベースマイグレーションの適用

```bash
cd worker
wrangler d1 migrations apply cloudflare-drive-db --local   # ローカル開発
wrangler d1 migrations apply cloudflare-drive-db --remote  # 本番環境
```

### 4. Cloudflare Access の設定

Zero Trust → Access → Applications で 2 つのアプリケーションを作成：

1. **メインアプリ** — `drive.yourdomain.com` → Allow ポリシーを追加（メール/ドメイン）
2. **バイパスアプリ** — `drive.yourdomain.com/s/*`、`drive.yourdomain.com/api/v1/s/*`、`drive.yourdomain.com/assets/*` → **Bypass** ポリシーを追加（Include → Everyone）

### 5. ローカル開発

```bash
# ターミナル 1：Worker
pnpm dev:worker   # localhost:8787 で起動

# ターミナル 2：フロントエンド
pnpm dev:frontend # localhost:5173 で起動、/api を localhost:8787 にプロキシ
```

### 6. デプロイ

```bash
# フロントエンドのビルド
pnpm build:frontend

# Worker のデプロイ（ASSETS バインディングでフロントエンドを含む）
cd worker
wrangler deploy
```

---

## API エンドポイント

全エンドポイントは `/api/v1` で始まります。

### ファイル

| メソッド | パス                                      | 説明                               |
| -------- | ----------------------------------------- | ---------------------------------- |
| `GET`    | `/api/v1/files`                           | ルートディレクトリの一覧           |
| `GET`    | `/api/v1/files?parentId={id}`             | フォルダ内容の一覧                 |
| `GET`    | `/api/v1/files/search?q=`                 | ファイル検索                       |
| `GET`    | `/api/v1/files/by-hash?hash=`             | SHA-256 ハッシュで検索（重複排除） |
| `POST`   | `/api/v1/files/instant`                   | 瞬時アップロード                   |
| `GET`    | `/api/v1/files/:id`                       | ファイル/フォルダメタデータの取得  |
| `POST`   | `/api/v1/files`                           | フォルダの作成                     |
| `POST`   | `/api/v1/files/upload`                    | ファイルアップロード（50MB以下）   |
| `POST`   | `/api/v1/files/upload/chunk`              | チャンクのアップロード             |
| `POST`   | `/api/v1/files/upload/:uploadId/complete` | チャンクアップロードの完了         |
| `POST`   | `/api/v1/files/:id/copy`                  | ファイル/フォルダのコピー          |
| `PATCH`  | `/api/v1/files/:id`                       | 名前変更/移動                      |
| `DELETE` | `/api/v1/files/:id`                       | ゴミ箱へ移動                       |
| `GET`    | `/api/v1/files/:id/download`              | ファイルのダウンロード             |

### ゴミ箱

| メソッド | パス                        | 説明             |
| -------- | --------------------------- | ---------------- |
| `GET`    | `/api/v1/trash`             | ゴミ箱の一覧     |
| `DELETE` | `/api/v1/trash/:id`         | 完全削除         |
| `POST`   | `/api/v1/trash/:id/restore` | ゴミ箱から復元   |
| `POST`   | `/api/v1/trash/empty`       | ゴミ箱を空にする |

### 共有リンク

| メソッド | パス                                | 説明                              |
| -------- | ----------------------------------- | --------------------------------- |
| `GET`    | `/api/v1/shares`                    | 共有リンクの一覧                  |
| `POST`   | `/api/v1/shares`                    | 共有リンクの作成                  |
| `DELETE` | `/api/v1/shares/:id`                | 共有リンクの取り消し              |
| `GET`    | `/api/v1/s/:token`                  | 公開アクセス（ファイル/フォルダ） |
| `GET`    | `/api/v1/s/:token/download`         | 公開ファイルのダウンロード        |
| `GET`    | `/api/v1/s/:token/download/:fileId` | 共有フォルダ内のファイルをDL      |

---

## Cloudflare 無料枠制限 (2026年)

- **Workers**：1日10万リクエスト
- **D1**：5 GB ストレージ、月500万行読み取り、10万行書き込み
- **R2**：10 GB ストレージ、月100万 Class A 操作、1000万 Class B 操作
- **Cloudflare Access**：最大50ユーザー（無料版）

個人向けクラウドドライブは通常これらの制限を超えることはありません。

---

## ライセンス

このプロジェクトは MIT License の下で公開されています。
