# open-karte

オープンソースの、社内事務手続きのためのセルフホスト基盤。Claude などの AI エージェントから CLI で呼ばれることを前提に設計し、人が操作する Web UI も提供する。

従業員台帳を土台に、「人・時間・物・お金・成長」をめぐる申請・承認・記録を束ねる。五軸は排他的な機能分類ではなく、複数付与できる検索と説明の観点として扱う。事実の記録・更新・検索と、それにまつわる申請ワークフローを対象にし、給与・税・労務のような重い計算や法的判定は外部に委ねる。

TypeScript のモノレポ。API を業務規則と認可の正本とし、Web と CLI が操作ごとの提供面になる。提供範囲は操作ごとに異なる。

```text
open-karte/
├── api/             # API サーバ (Hono / Cloudflare Workers)
├── cli/             # karte コマンド (Hono / bun)
├── web/             # Web UI (Next.js)
├── Makefile
├── package.json     # bun workspaces (api, cli, web)
└── README.md
```

ワークスペースの構成は以下のとおり。

- `api` … HTTP API。Hono + Cloudflare Workers (wrangler)
- `cli` … `karte` コマンド。引数を POST に変換しローカル Hono ルートで処理し、API を叩く
- `web` … Web UI。Next.js + React + Tailwind + shadcn

## 必要環境

- [bun](https://bun.sh)

## セットアップ

```sh
make dev      # bun install して portless で全アプリ起動
```

個別に動かす場合は `make help` を参照。

起動後は web（`https://karte.open.localhost`）に開発用シードのアカウントでログインできる。メールは `you+e001@example.com`、パスワードは `password`（`E001` が admin）。seed は全ユーザー共通の既知パスワードで、本番には投入しない。

## CLI

```sh
cd cli
bun install
bun link          # karte コマンドを PATH に通す
karte --help
```

各コマンドは `~/.karte/config.json` のトークンで API を叩く。接続先は環境変数 `KARTE_API`（既定 `http://127.0.0.1:8787`）で上書きできる。

```sh
karte login --email you@example.com --password your_password_here
karte whoami
karte employee search --q プログラマ
karte app inbox
```

コマンド体系の詳細は [`cli/README.md`](cli/README.md) を参照。

## API

```sh
cd api
bun install
bun run dev        # wrangler dev
bun run deploy     # 本番デプロイ
```

URL は「資源は複数形名詞、状態遷移は資源配下の動詞 POST」で統一している。ルート一覧は `api/src/app.ts` を参照。

シードデータ（`api/seeds/`）は開発専用。全ユーザーが同一の既知パスワードのため、本番には投入しないこと。詳細は [`api/seeds/README.md`](api/seeds/README.md) を参照。

## Web

```sh
cd web
bun install
bun run dev        # Next.js dev server
```

ログイン後の画面はドメインごとのルートに collocation されている。
詳細は [`web/README.md`](web/README.md) を参照。

## テストと検証

```sh
vp check                 # フォーマット + lint（リポジトリ全体）
cd api && bun test       # API のテスト
cd cli && bun test       # CLI のテスト
cd web && bunx tsc --noEmit   # Web の型検査
```

api のルートを変更したら `cd api && bun run build:types` で型を再生成すると、web の型付きクライアント（hc）が追従する。

## ドキュメント

プロダクトの仕様・用語・業務知識は [`.docs/`](.docs/index.md) に集約している。

- `architecture.md` … ワークスペース構成・レイヤ・認証・セキュリティ
- `company-model.md` … 会社を表現する三層モデルと共通概念
- `capability-map.md` … 会社能力の網羅分類と現在の実装範囲
- `authorization-model.md` … システム権限・組織関係・案件割当を合成する認可規範
- `features.md` … 利用者視点の機能一覧
- `sitemap.md` / `user-flows.md` … web の画面と導線
- `glossary.md` / `references/terms/` … 制度用語の定義
- `notes/handbook/` … 入社・休暇・経費などの手続きノート

## ライセンス

[LICENSE](LICENSE) を参照。
