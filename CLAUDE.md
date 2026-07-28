- ./@package.json
- ./Makefile

オープンソースの、社内事務手続きのためのセルフホスト基盤。TypeScript のモノレポ。
Claude などの AI から CLI で呼ばれることを前提に設計。

## 製品の目的と構想

従業員台帳を土台に、「人・時間・物・お金・成長」をめぐる申請・承認・記録を束ねる。
扱うのは事実の記録・更新・検索と、それにまつわる申請ワークフローまで。

- この基盤の上に、本の貸し借りや会議室の予約のような業務レベルのアプリを載せられる基盤にする
- 外部の AI エージェントがここに集まるデータを安全に読み書きし、AI が十分に労働できるためのデータ基盤であることを常に意識する。連携は汎用の API・認証機構として設計し、特定の外部システムを前提にしない

## 機能の三段分類

すべての機能は次の三段のいずれかに属する。新機能の設計時は必ずどの段かを明示し、必要なものだけ有効化できるよう切り替え（環境変数・設定）を設計に含める。

1. 基盤レイヤー … アカウント、ログイン、システムロール、システム権限。どのような社内システムにも必要な層
2. コア機能 … 従業員台帳、申請・承認・記録など、会社に必ず要る機能。ただし給与・税・労務のような重い計算・法的判定は外部製品の責務とし、ここでは事実の記録と外部連携に留める
3. 選択機能 … 打刻など、会社の規模や目的によっては社内で管理したい機能。既定は無効とし、有効化して使う

## 公開リポジトリの絶対規範

このリポジトリは公開されつつ社内でも使われる。以下は例外なく厳守する。違反の疑いがあれば作業を止めて確認する。

- 自社・他社の固有名詞、製品名、個人情報、認証情報を、コード・ドキュメント・コミット履歴・Issue・PR に絶対に含めない
- 社内のインフラ構成、社内の別システムとの統合の詳細も同様に絶対に含めない。社内固有の統合が必要なときは、環境変数・アダプタ・webhook のような汎用のプラグイン点として設計し、固有部分はこのリポジトリの外に置く
- サンプルは `you@example.com` のような汎用値を使う
- コミット前に混入がないか必ず確認する。疑わしいものはコミットしない

## 単体で成立する製品

- 特定の社内システム・インフラに依存しない。この製品単体でセットアップから運用まで完結すること
- ログイン手段は複数（パスワード、外部 IdP 等）を用意し、環境変数で切り替えられる仕組みを保つ。認証に関わる新要件は必ずこの切替機構に載せ、特定手段を前提にしたコードを書かない

## 構成

Bun Workspaces のモノレポ。3つのワークスペースで構成する。

- `api` … HTTP API。Hono + Cloudflare Workers (wrangler)
- `cli` … 引数を POST に変換しローカルで処理。Hono + bun
- `web` … Web UI。Next.js + React + Tailwind + shadcn

ディレクトリの構成は以下のとおり。

- `api/src/` … domain / application / infrastructure / interface の4層。interface は `routes/` 配下に Next.js App Router 記法でルートを定義し（`routes/<URLパス>/route.ts`、URL とディレクトリを一致させる。動的セグメント `[param]`）、`app.ts` が `:param` に対応づけて登録する。同一 URL に別メソッドを足す場合は `create-route.ts` のような `<動詞>-route.ts` を同ディレクトリに並置する。ルート横断のコードは内容を表す名前のディレクトリに置く（`middlewares/`、`utils/`、`test-helpers/` など。`shared/` のような中身のわからない名前は禁止）。API レスポンスは `lib/app-schemas.ts` の zApp スキーマで parse してから返す（1 ファイル 1 スキーマ規約の例外として集約）
- `cli/app/` … コマンド群。`<command>/.../route.ts` で定義し、`cli/app/index.ts` が POST ルートとして集約する。ルート追加時は index.ts への登録を忘れない（未登録だと catch-all に落ちて使用不可）。共通処理は `cli/lib/`
- `web/app/(app|auth)/` … ルートグループ。ルート直下は `page.tsx` / `actions.ts` などの規約ファイルのみ。画面コンポーネントは各ルートの `_components/`、表示用純関数は `_lib/` に collocation する。`components/ui` は shadcn 生成物（直接編集しない）、独自コンポーネントは別ファイルでラップする
- `web/lib/api/` … API クライアント関数（1 関数 1 ファイル）。`api/app` の型（`api/dist/app.d.ts`）で型付けされる。レスポンスの手書き型は `web/lib/api/types/` に置く（api と疎結合に保つため z.infer を参照せず同形を手書きする）

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
- コミット前に固有名詞・個人情報・認証情報・社内インフラや社内システム統合の情報が混入していないか確認する

## ドキュメント

- `.docs/` を変更する場合は `.docs/CLAUDE.md` に従う
- 製品の意味、境界、不変条件は `.docs/` を正本とする。route、table、column、入出力型の現存確認はコード、migration、生成型を使う
- 仕様と実装の差を暗黙に読み替えない。未解決の権限、状態、外部副作用は安全側へ拒否し、未実装差分として明示する
