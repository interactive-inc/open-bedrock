# route 層 最終整形ガイド（export メソッド名 + HTTPException）

各ドメインの route.ts を「HTTP メソッド名で export」「エラーは throw new HTTPException」に整える。

## 設計（確定）

1. **route は HTTP メソッド名で export**: `export default factory.createHandlers(...)` をやめ、`export const GET = factory.createHandlers(...)` / `export const POST = ...` / `export const PUT = ...` / `export const DELETE = ...` にする。
   - そのファイルのパスに対応するメソッドを export 名にする（GET ルートなら GET、POST なら POST）。
   - ハンドラ変数に `buildXxxHandler` のような長い名前を付けない。`export const <METHOD> = factory.createHandlers(...)` の形。
   - 参考: ~/open-stack-app-drizzle/src/api/interface/routes/projects.ts（export const GET と export const POST が同居）。
2. **エラーは throw new HTTPException**: route 内の `return c.json({ error: "..." }, <status>)` を全て `throw new HTTPException(<status>, { message: "..." })` に変える。`import { HTTPException } from "hono/http-exception"`。
   - 401: `throw new HTTPException(401, { message: "unauthorized" })`
   - 403: `throw new HTTPException(403, { message: "forbidden" })`
   - 404: `throw new HTTPException(404, { message: "<...> not found" })`
   - 400: `throw new HTTPException(400, { message: "<...>" })`
   - 500: `throw new HTTPException(500, { message: "<...>" })`
   - 成功レスポンス（c.json(body, 200) / 201）はそのまま return する。
   - これは interface 層（route）のみ。application/domain/infrastructure は引き続き `T | Error` を返す（throw 禁止）。route が Error を受けたら `throw new HTTPException(500, {message})` 等に変換する。
3. onError（app.ts）は `if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)` で JSON 化する（統合担当が app.ts で対応）。

## 注意

- 1つの route.ts が単一メソッドなら export はそのメソッド1つ。複数メソッドが同一パスにある場合のみ複数 export（このプロジェクトはパスごとにファイル分割されているので通常は1つ）。
- テストは `requestWithContext` 経由でステータスとエラー body（{ error: message }）を検証している。HTTPException → onError の変換後も `{ error: message }` + status が一致するよう、message は元の error 文言と同じにする。
- ts.md: @/ 絶対パス, const のみ, destructuring 禁止, セミコロンは付けてよい。

## app.ts（統合担当が実施、エージェントは触らない）

- 全 route を `import * as <name> from "@/interface/<...>/route"` で読み込み、`export const app = factory.createApp().use(...).<method>("<path>", ...<name>.<METHOD>)...` のメソッドチェーンにする。
- `export type AppType = typeof app`。
- onError を HTTPException 対応に。

## 報告

変更した route 数、export 形式（GET/POST 等）、HTTPException に変えた箇所数、テスト結果を報告する。
