# cli ルート移植ガイド（旧混在 → Next.js風 route.ts + 末端コロケーション）

cli の各コマンドを `routes/<command-path>/route.ts` 形式に統一する。`org` が完成済みの**手本**。

## 手本（必ず読む）

- routes/org/route.ts … `karte org`（親ヘルプ）。`export default factory.createHandlers((c) => c.text(help))`
- routes/org/tree/route.ts … `karte org tree`。zValidator + api 呼び出し + renderer
- routes/org/tree/\_modules/render-org-tree.ts … このコマンド専用 renderer の**末端コロケーション**例
- routes/org/members/[dept_code]/route.ts … 動的引数 `[dept_code]`
- routes/org/line/[employee_code]/route.ts … 動的引数

## 設計ルール

1. **1コマンド = 1 `routes/<path>/route.ts`**。各 route.ts は `export default factory.createHandlers(...)`、ヘルプ用に `export const help = ...` も付ける（既存踏襲）。
2. **コマンドパス = URL パス = ディレクトリ階層**。例 `karte app submit <code>` は URL `/app/submit/:template_code?` → `routes/app/submit/route.ts`。
3. **位置引数（param）は Next.js記法の `[name]` ディレクトリ**。例 `/app/show/:app_id?` → `routes/app/show/[app_id]/route.ts`。zValidator("param", ...) はそのまま。
4. **ドメインのトップ（`karte app` 単体のヘルプ）は `routes/<domain>/route.ts`**。
5. **そのコマンドでしか使わないモジュール（専用 renderer 等）は同階層の `_modules/` にコロケーション**。複数コマンドで共有する `@/_modules/http/client`・`@/_modules/render/table`・`@/_modules/io/read-json`・`@/_modules/config/config` は上位 `_modules/` のまま使う。
6. **旧ファイルは削除**: flat な `routes/<domain>.ts`（named export 寄せ集め）と、旧 `routes/<domain>/<command>.ts`（route.ts でないもの）、旧 `routes/<domain>/index.ts`。
7. **index.ts は編集しない**（共有・競合する）。代わりに登録情報を報告する（下記）。
8. import は `@/` 絶対パスのみ。型は type のみ。`as` は既存コードに準ずる（既存の `x[col] as string` 等は踏襲してよい）。セミコロンは付けてよい（fmt semi:false が消す）。

## index.ts への登録（報告のみ）

現状 routes/index.ts が全ハンドラを named/default import して `routes.post("<path>", ...handler)` で登録している。
移植エージェントは index.ts を編集せず、担当ドメインについて以下を報告する:

- 各コマンドの「import 文」（例: `import appSubmitHandler from "@/routes/app/submit/route"`）
- 各コマンドの「登録行」（例: `routes.post("/app/submit/:template_code?", ...appSubmitHandler)`）
- パスは現状 index.ts の登録と**完全一致**させる（`:template_code?` 等のパラメータ名・optional `?` も保つ）。これで CLI の挙動が変わらない。

## 検証

`bun /Users/i/open-karte/cli/index.ts <domain> <command> --help` でヘルプが出れば配線確認できる（ただし index.ts 統合後）。移植中はファイル単体の構文と import 解決を確認する。
