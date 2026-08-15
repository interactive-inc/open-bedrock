- ./@package.json
- ./Makefile

オープンソースの、社内事務手続きのためのセルフホスト基盤。TypeScript のモノレポ。
Claude などの AI から CLI で呼ばれることを前提に設計。

## 製品の目的と構想

従業員台帳を土台に、「人・時間・物・お金・成長」をめぐる申請・承認・記録を束ねる。
扱うのは事実の記録・更新・検索と、それにまつわる申請ワークフローまで。

- この基盤の上に、本の貸し借りや会議室の予約のような業務レベルのアプリを載せられる基盤にする
- 外部の AI エージェントがここに集まるデータを安全に読み書きし、AI が十分に労働できるためのデータ基盤であることを常に意識する。連携は汎用の API・認証機構として設計し、特定の外部システムを前提にしない

## 会社の解体図

会社に必要なシステム全体を System、Company、Apps、外部連携に分ける。`company-core` という名前は使わず、会社の正本は `company` と呼ぶ。標準と任意は所有境界ではなく App の既定有効状態として表す。詳細と実装状態は `.docs/feature-tiers.md` と `.docs/capability-map.md` に記録する。

依存方向は `業務コンテキスト -> company -> system` の一方向とする。すべてを `api/src/contexts/<context>/` 直下へ対等に置き、`apps/` という親ディレクトリは作らない。System は Company と業務語彙を知らず、業務コンテキスト同士も直接依存しない。

System は次を所有する。

- Human、Agent、Service、Connector の Principal、Account、Identity、認証、session、失効
- technical permission、role、policy、scope、field policy、職務分離、緊急アクセス
- procedure definition、case、task、proposal、decision、human attestation、delegation、approval、rejection、差戻し、取消、execution authorization
- 変更不能な提案 digest、実行直前の再検査、冪等性、排他、競合検出
- audit event、evidence、attachment metadata、版、来歴、訂正、保持、開示制御
- notification、scheduler、batch、job、outbox、inbox、retry、dead letter
- API、webhook、import、export、connector、external assertion、reconciliation
- 設定、機能有効化、health、migration safety、運用診断

案件、判断、委任、実行許可の責任分担、不変条件、現行実装差分は `.docs/system-workflow.md` に従う。

Company は次を所有する。

- LegalEntity、会社 profile、法域、locale、timezone、通貨、会計年度などの会社文脈
- 事業所と勤務場所の識別、および法人、拠点、組織単位の区別
- Person、Employee、Employment、在籍状態と有効期間
- OrgUnit、Department、Membership、ReportingRelation
- Job、Position、Grade、OrganizationalOffice と期間付き割当
- ResponsibilityAssignment、OrganizationalAuthority、CollectiveBody
- System Account と Employee の対応、および System の汎用判断へ会社上の資格を提供する解決処理
- 入社、異動、休職、復職、退職、再入社という雇用事実と人事発令

削除可能な業務機能はすべて独立した App コンテキストにする。対象は次のとおり。

- 汎用手続き: request。個別 App の共通 workflow library にはせず、request 自身の template と提案だけを所有する
- 社内情報: announcement、knowledge、meeting、regulation、governance-document
- 採用と人事手続き: recruitment、onboarding、offboarding、certificate-request、life-event、work-style、headcount-plan
- 時間: attendance、leave、family-care-leave、shift、company-calendar、business-trip
- 社内の金銭手続き: expense、budget、ringi、compensation-change
- 資源と施設: asset、stocktake、room、rental、software-license
- 対外管理: partner、contract、antisocial-check
- 安全と規律: health-checkup、work-accident、disciplinary-action、commendation、it-incident
- 成長と対話: goal、performance-review、skill、certification、training、career、one-on-one、survey、thanks

dashboard、inbox、directory、search は複数コンテキストの read model または UI composition であり、業務事実の正本を所有するコンテキストにしない。

次は製品内に実装しない。製品は依頼、承認済み指示、外部結果、採否、照合、証跡だけを保持し、将来の API connector で専門製品へ接続する。

- 総勘定元帳、仕訳、決算、財務諸表、税額計算、税務申告
- 給与、賞与、源泉徴収、社会保険料、年末調整の計算
- 送金、決済、清算、銀行残高、法人カード取引の実行
- 法令適合性、契約解釈、届出義務、電子署名の法的効力の最終判断
- 本人確認、信用、制裁、反社会的勢力、医学的・労務的適否の最終判断
- 販売、CRM、受注、顧客提供、在庫、製造、物流という事業固有システム

## 完成条件

新しい System 能力、Company 能力、App は次をすべて満たすまで公開しない。schema だけ、画面だけ、任意 JSON だけの実装を機能として数えない。

- 対象、主体、状態、出来事、有効期間、版、source of truth、不変条件が型と制約で定義されている
- 作成、参照、変更、取消、失敗、競合、訂正、再試行の結果が定義されている
- technical permission と会社上の authority を合成し、評価不能時は拒否する
- migration、外部キー、一意制約、transaction、冪等性、同時実行の保護がある
- 重要な変更に監査、actor chain、理由、証拠、変更前後または再構成可能な履歴がある
- API の入力と出力を検証し、Web、CLI、AI、callback に同じ application rule を適用する
- unit、application、repository、route、認可、失敗、再試行のテストがある
- App は有効化と無効化を強制でき、ディレクトリと route 登録の削除が他の業務コンテキストへ影響しない
- 外部連携は timeout、重複、順序逆転、部分失敗、再送、照合不能を安全側に処理する

既存機能がこの条件を満たさない場合は `.docs/capability-map.md` で未完成と明示し、完成するまで新しい依存元を増やさない。

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

Bun Workspaces のモノレポ。4つのワークスペースで構成する。

- `api` … HTTP API。Hono + Cloudflare Workers (wrangler)
- `cli` … 引数を POST に変換しローカルで処理。Hono + bun
- `mcp` … MCP server。API を MCP tools として AI エージェントに公開。Bun + @modelcontextprotocol/sdk
- `web` … Web UI。Next.js + React + Tailwind + shadcn

ディレクトリの構成は以下のとおり。

- `api/src/contexts/<context>/` … contextごとの domain / application / infrastructure / interface の4層。interface は `routes/` 配下に Next.js App Router 記法でルートを定義し（`routes/<URLパス>/route.ts`、URL とディレクトリを一致させる。動的セグメント `[param]`）、`api/src/api/app.ts` が `:param` に対応づけて登録する。`app.ts` は `bun run gen:app` の生成物なので手で編集しない（後述）。同一 URL に別メソッドを足す場合は `create-route.ts` のような `<動詞>-route.ts` を同ディレクトリに並置する。ルート横断のコードは内容を表す名前のディレクトリに置く（`middlewares/`、`utils/`、`test-helpers/` など。`shared/` のような中身のわからない名前は禁止）。API レスポンスは `lib/app-schemas.ts` の zApp スキーマで parse してから返す（1 ファイル 1 スキーマ規約の例外として集約）
- `api/src/api/` … HTTP runtimeのcomposition root。手書きmiddleware、route registry、生成app、複数contextを正本なしで集約するroute、複数層を横断するtestだけを置く。Domainや業務実装は置かない
- `api/src/lib/` … context中立で、context・API root・DB所有schemaへ依存しない技術部品だけを置く
- `cli/app/` … コマンド群。`<command>/.../route.ts` で定義し、`cli/app/index.ts` が POST ルートとして集約する。ルート追加時は index.ts への登録を忘れない（未登録だと catch-all に落ちて使用不可）。共通処理は `cli/lib/`
- `web/app/(app|auth)/` … ルートグループ。ルート直下は `page.tsx` / `actions.ts` などの規約ファイルのみ。画面コンポーネントは各ルートの `_components/`、表示用純関数は `_lib/` に collocation する。`components/ui` は shadcn 生成物（直接編集しない）、独自コンポーネントは別ファイルでラップする
- `web/lib/api/` … API クライアント関数（1 関数 1 ファイル）。`api/app` の型（`api/dist/api/app.d.ts`）で型付けされる。レスポンスの手書き型は `web/lib/api/types/` に置く（api と疎結合に保つため z.infer を参照せず同形を手書きする）

## API の URL 規約

- 資源は複数形名詞（`/employees`、`/application-templates`、`/oneonones`）
- 自分のリソースは `/me`、承認待ちは `/inbox` のサブリソース
- 状態遷移は資源配下の動詞 POST（`/applications/:id/approve`、`/review-cycles/:cycle_id/open`）

## ローカル起動・動作確認

起動は portless 経由が前提（`make dev` = `bun install` のうえ `portless`）。

ブラウザで確認する手順:

- まず `bun install` を必ず実行する（飛ばすと web が `Module not found: 'zod'` 等の依存解決エラーになる）
- 初回は `cd api && bun run db:migrate:local` でローカル D1 を作成し、`bun run db:seed:local` で seed を投入する
- `cd api && bun run setup:dev-vars` で `.dev.vars` を生成する（`JWT_SECRET` と `AUDIT_HMAC_SECRET` をランダムに作る。既存ファイルは上書きしない。`.dev.vars` は gitignore 済み）。api は未設定・16 文字未満・`-change-me` で終わる秘密値を実行時に拒否するので、`.dev.vars.example` をそのままコピーしても動かない
- `.dev.vars` には `ENABLED_OPTIONAL_FEATURES="all"` も必要（互換用の変数名であり、無いと opt-in App が既定で無効になり API が 404 を返す。正本は `.docs/feature-tiers.md`）
- リポジトリ root で `portless` を実行すると web/api が同時に立つ。web は `https://bedrock.localhost`、api は `https://api.bedrock.localhost`（実体は `localhost:18787`）。ホスト名の正本は `portless.json`。`.localhost` は Chrome 等がそのまま解決し、portless の CA はシステムに信頼登録済み
- ログインは seed の `you+e001@example.com` / `password`（`E001` が admin）。ダッシュボード・従業員一覧まで表示されれば web→api→D1 の通し動作 OK

api 単体の疎通だけ見るなら `cd api && bun run dev`（wrangler dev の自動再起動ラッパー、ポート 18787）。`/` は 404 が正常、`/employees` は未認証で 401。`POST /auth/login` で access_token を取り `Authorization: Bearer` で叩く。

wrangler dev は「Network connection lost.」で稀にプロセスごと落ちることがある。api だけが落ちると web は生き残り、全ページが 500（`failed to load me (503)`）や api ホストが Next 由来の 404 HTML を返す状態になる。アプリのバグに見えるが、まず api の生死（`curl http://localhost:18787/health`）を疑うこと。`bun run dev`（`scripts/dev-restart.sh`）は落ちたことをログに出して自動で再起動する。再起動なしで素の wrangler を使うときは `bun run dev:no-restart`。

web↔api クライアントの約束:

- web/cli は `api/app` から `AppType` / `ApiClient` を type-only で import し、`hc<AppType>()` を自前で生成する（`web/lib/api/hc-client.ts`、`cli/lib/http/hc-client.ts` 参照）
- `api/app` の `exports.default` は `./src/api/app.ts`。ここから実行時の値（旧 `hcWithType` 等）を import すると、bundler が app.ts 経由で全ルートと api の `@/` を取り込もうとして `Module not found: @/interface/...` で dev ビルドが落ちる。クライアント側は必ず型のみ参照にすること

## 変更時の確認

- 変更後は `vp check` を通す。`api` の変更はテスト（`cd api && bun test`）も実行する
- `api` のルートや入出力を変更したら `cd api && bun run build:types` で型を再生成し、`cd web && bunx tsc --noEmit` で web の追従を確認する
- `cli` の変更は `cd cli && bun test` を実行する
- コミット前に固有名詞・個人情報・認証情報・社内インフラや社内システム統合の情報が混入していないか確認する

## ルート登録と認可の機械検査

`api/src/api/app.ts` は生成物であり、手で編集しない。単一contextのルートは `src/api/route-module.registry.ts` に登録済みのcontext配下へ置く。複数contextのread modelだけを合成するルートは `src/api/routes` へ置き、正本や状態遷移を持たせない。変更後は `cd api && bun run gen:app` を実行する。生成器は登録された `routes/` だけを走査して `export const GET|POST|PUT|PATCH|DELETE` を登録し、静的パスを動的パスより先に並べる（Hono は同じ形の候補を登録順で解決するため、`/expenses/me` が `/expenses/:id` より後ろにあると食われる）。middleware・エラーハンドラは手書きの `src/api/app-base.ts` が持つ。`/health` はSystem contextのrouteとして明示登録する。

`bun run gen:app:check` が生成物と `routes/` のズレを検出する。登録漏れ＝ルート消失は、実装があるのに到達できず、テストも「そのルートを呼ばない」だけで緑のまま通るため、規約ではなく検査で防ぐ。

各 handler は認可の方針を 1 行で宣言する。宣言は `export const GET` などの直前に、メソッドごとに置く（同じファイルでも一覧は全員閲覧可・登録は権限必須のように方針が違うため）。`bun run lint:route-authorization` が宣言の有無と、宣言と認証 middleware の整合を検査する。

```ts
// @authorization permission - 権限キーで判定する
// @authorization service    - session を application service に渡して判定する
// @authorization owner      - 本人のリソースに限定する
// @authorization authenticated - ログインしていれば誰でも読める共有データ
// @authorization public     - 未認証で到達してよい
// @authorization machine    - 機械用のキーで認証する
```

宣言を要求するのは、認可の判断がルートファイルの中にあるとは限らないため。実際には権限キーの直接判定、専用 middleware、application service への委譲、本人限定の絞り込みに分かれており、ルートファイルを grep する検査は誤検知が大半になる。

この検査が保証するのは「認可の方針を書き忘れていない」ことだけである。宣言が実態と合っているかは検査しない（`permission` と書いて中身が素通しでも通る）。つまり棚卸しであって認可の強制ではない。認可の正本は各 handler と application service のコードで、その正しさはレビューとテストで見る。「検査が緑だから安全」とは読まないこと。`authenticated` と `public` は意図的に緩いという表明なので、付けるときは理由を確認する。

これらの検査（gen:app:check、lint:route-authorization、lint:system-boundary、verify-seed）は `bun run check`（api）に組み込んである。`lint:system-boundary` はシステム層（`src/domain/system` ほか）が、自動検出した下位 context の語彙・モジュールや混在 schema へ依存していないことを TypeScript AST で検査する。`verify-seed` は migration と `seeds/*.sql` を in-memory SQLite に適用し、schema 変更への seed の追従漏れを検出する。

## ドキュメント

- `.docs/` を変更する場合は `.docs/CLAUDE.md` に従う
- 製品の意味、境界、不変条件は `.docs/` を正本とする。route、table、column、入出力型の現存確認はコード、migration、生成型を使う
- 仕様と実装の差を暗黙に読み替えない。未解決の権限、状態、外部副作用は安全側へ拒否し、未実装差分として明示する
