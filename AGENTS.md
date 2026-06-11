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

## 変更時の確認

- 変更後は `vp check` を通す。`api` の変更はテスト（`cd api && bun test`）も実行する
- `api` のルートや入出力を変更したら `cd api && bun run build:types` で型を再生成し、`cd web && bunx tsc --noEmit` で web の追従を確認する
- `cli` の変更は `cd cli && bun test` を実行する
- コミット前に固有名詞・個人情報・認証情報の混入がないか確認する

## ドキュメント

- 仕様・用語・業務知識は `.docs/` に集約。実装と乖離させないこと（ルート一覧などは「コードが正」の方針）
- Markdown の書式は `.claude/rules/md.md` に従う
