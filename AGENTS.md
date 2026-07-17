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

起動は portless 経由が前提（`make dev` = `bun install` のうえ `portless`）。

ブラウザで確認する手順:

- まず `bun install` を必ず実行する（飛ばすと web が `Module not found: 'zod'` 等の依存解決エラーになる）
- 初回は `cd api && bun run db:migrate:local` でローカル D1 を作成し、`bun run db:seed:local` で seed を投入する
- `cp api/.dev.vars.example api/.dev.vars` で `JWT_SECRET` を用意する（無いとログインが 500 になる。`.dev.vars` は gitignore 済み）
- リポジトリ root で `portless` を実行すると web/api が同時に立つ。web は `https://karte.open.localhost`、api は `https://api.karte.open.localhost`（実体は `localhost:18787`）。`.localhost` は Chrome 等がそのまま解決し、portless の CA はシステムに信頼登録済み
- ログインは seed の `you+e001@example.com` / `password`（`E001` が admin）。ダッシュボード・従業員一覧まで表示されれば web→api→D1 の通し動作 OK

api 単体の疎通だけ見るなら `cd api && bun run dev`（= `wrangler dev`、ポート 18787）。`/` は 404 が正常、`/employees` は未認証で 401。`POST /auth/login` で access_token を取り `Authorization: Bearer` で叩く。

web↔api クライアントの約束:

- web/cli は `api/app` から `AppType` / `ApiClient` を type-only で import し、`hc<AppType>()` を自前で生成する（`web/lib/api/hc-client.ts`、`cli/lib/http/hc-client.ts` 参照）
- `api/app` の `exports.default` は `./src/app.ts`。ここから実行時の値（旧 `hcWithType` 等）を import すると、bundler が app.ts 経由で全ルートと api の `@/` を取り込もうとして `Module not found: @/interface/...` で dev ビルドが落ちる。クライアント側は必ず型のみ参照にすること

## 変更時の確認

- 変更後は `vp check` を通す。`api` の変更はテスト（`cd api && bun test`）も実行する
- `api` のルートや入出力を変更したら `cd api && bun run build:types` で型を再生成し、`cd web && bunx tsc --noEmit` で web の追従を確認する
- `cli` の変更は `cd cli && bun test` を実行する
- コミット前に固有名詞・個人情報・認証情報の混入がないか確認する

## ドキュメント

- `.docs/` を変更する場合は `.docs/CLAUDE.md` に従う
- 製品の意味、境界、不変条件は `.docs/` を正本とする。route、table、column、入出力型の現存確認はコード、migration、生成型を使う
- 仕様と実装の差を暗黙に読み替えない。未解決の権限、状態、外部副作用は安全側へ拒否し、未実装差分として明示する
- Markdown の書式は `.claude/rules/md.md` に従う
