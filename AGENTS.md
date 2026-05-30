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
- `cli/app/` … コマンド群。`<command>/.../route.ts` で定義し、`cli/app/index.ts` が POST ルートとして集約する。共通処理は `cli/lib/`
- `web/app/(app|auth)/` … ルートグループ。`components/ui` は shadcn 生成物（直接編集しない）、独自コンポーネントは別ファイルでラップする

## 変更時の確認

- 変更後は `vp check` を通す。`api` の変更はテストも実行する
- コミット前に固有名詞・個人情報・認証情報の混入がないか確認する
