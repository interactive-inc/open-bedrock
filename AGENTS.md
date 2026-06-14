- ./@package.json
- ./Makefile

オープンソースの、社内事務手続きのためのセルフホスト基盤。TypeScript のモノレポ。
Claude などの AI から CLI で呼ばれることを前提に設計。

従業員台帳を土台に、「人・時間・物・お金・成長」をめぐる申請・承認・記録を束ねる。
扱うのは事実の記録・更新・検索と、それにまつわる申請ワークフローまで。
給与・税・労務のような重い計算や法的判定は持たず、外部に委ねる。

> **公開リポジトリ**: 自社・他社の固有名詞、製品名、個人情報、認証情報をコード・ドキュメント・
> コミットに含めないこと。サンプルは `you@example.com` のような汎用値を使う。

## 構成

Bun Workspaces のモノレポ。3つのワークスペースで構成する。

- `api` … HTTP API。Hono + Cloudflare Workers (wrangler)
- `cli` … 引数を POST に変換しローカルで処理。Hono + bun
- `web` … Web UI。Next.js + React + Tailwind + shadcn

ディレクトリの構成は以下のとおり。

- `api/src/` … domain / application / infrastructure / interface の4層。interface は Next.js App Router 記法（`<domain>/.../route.ts`、動的セグメント `[param]`）でルートを定義し、`app.ts` が `:param` に対応づけて登録する
- `cli/app/` … コマンド群。`<command>/.../route.ts` で定義し、`cli/app/index.ts` が POST ルートとして集約する。**ルート追加時は index.ts への登録を忘れない**（未登録だと catch-all に落ちて使用不可）。共通処理は `cli/lib/`
- `web/app/(app|auth)/` … ルートグループ。ルート直下は `page.tsx` / `actions.ts` などの規約ファイルのみ。画面コンポーネントは各ルートの `_components/`、表示用純関数は `_lib/` に collocation する。`components/ui` は shadcn 生成物（直接編集しない）、独自コンポーネントは別ファイルでラップする
- `web/lib/api/` … API クライアント関数（1 関数 1 ファイル）。`api/app` の型（`api/dist/app.d.ts`）で型付けされる

## API の URL 規約

- 資源は複数形名詞（`/employees`、`/application-templates`、`/oneonones`）
- 自分のリソースは `/me`、承認待ちは `/inbox` のサブリソース
- 状態遷移は資源配下の動詞 POST（`/applications/:id/approve`、`/review-cycles/:cycle_id/open`）

## ローカル起動・動作確認

全アプリ同時起動は `make dev`（`bun install` のうえ `portless`）。個別に動かす手順は以下。

api（Cloudflare Workers / wrangler、ポート 8787）:

- 初回は `cd api && bun run db:migrate:local` でローカル D1 を作成し、`bun run db:seed:local` で seed を投入する
- `cp api/.dev.vars.example api/.dev.vars` で `JWT_SECRET` を用意する（無いとログインが 500 になる。`.dev.vars` は gitignore 済み）
- `cd api && bun run dev`（= `wrangler dev`）。`/` は 404 が正常（ルート未定義）。`/employees` は未認証で 401
- seed の全ユーザーは共通パスワード `password`、メールは `you+e001@example.com` 形式。`E001` が admin
- 動作確認例: `POST /auth/login` で access_token を取得し、`Authorization: Bearer` で `/me` や `/employees` を叩く

web（Next.js、ポート 3000）:

- `cd web && NEXT_PUBLIC_API_URL=http://localhost:8787 bun run dev`（既定の API ベース URL も同値）
- 観測した注意点: web 単体で `next dev` すると `api/app`（`exports.default` が `./src/app.ts`）から `hcWithType` を実行時 import する関係で、bundler が api ソースの `@/` エイリアスを解決できず `Module not found: @/interface/...` になる（Turbopack / webpack 双方で再現）。ブラウザ確認が必要なときは `make dev`（portless）経由を優先し、直 `next dev` で同症状が出たらこの点を疑う

## 変更時の確認

- 変更後は `vp check` を通す。`api` の変更はテスト（`cd api && bun test`）も実行する
- `api` のルートや入出力を変更したら `cd api && bun run build:types` で型を再生成し、`cd web && bunx tsc --noEmit` で web の追従を確認する
- `cli` の変更は `cd cli && bun test` を実行する
- コミット前に固有名詞・個人情報・認証情報の混入がないか確認する

## ドキュメント

- 仕様・用語・業務知識は `.docs/` に集約。実装と乖離させないこと（ルート一覧などは「コードが正」の方針）
- Markdown の書式は `.claude/rules/md.md` に従う
