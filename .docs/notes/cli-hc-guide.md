# cli hc 化ガイド（api() → hc<AppType> RPC）

各 cli コマンドの `api<T>(path)` 呼び出しを、型安全な `hc<AppType>` クライアントに置き換える。`org` が手本。

## 設計（確定）

1. **クライアント生成**: `import { createClient } from "@/_modules/http/hc-client"` し、ハンドラ内で `const client = await createClient()`。
2. **呼び出しは hc メソッドチェーン**: api のパスを hc のプロパティチェーンに変換する。
   - `GET /org/tree` → `await client.org.tree.$get()`
   - `GET /org/departments/:code/members` → `await client.org.departments[":code"].members.$get({ param: { code: deptCode } })`（動的セグメントは `[":name"]`、値は `param`）
   - `POST /expenses` (json body) → `await client.expenses.$post({ json: { ... } })`
   - `GET /expenses/me?status=x` (query) → `await client.expenses.me.$get({ query: { status: x } })`
   - 複数セグメント: `GET /review-cycles/:cycle_id/results/:employee_code` → `client["review-cycles"][":cycle_id"].results[":employee_code"].$get({ param: {...} })`。ハイフンを含むセグメント（review-cycles）は `client["review-cycles"]` のブラケット記法。
3. **レスポンス**: `const response = await client.xxx.$get(...)`、`const data = await response.json()`。data の型は AppType から推論される。
   - 旧 `api<Array<Record<string, unknown>>>(path)` の手動型注釈は不要（hc が推論）。
   - render（table/pretty）に渡すとき、推論された型を `String(row[col as keyof typeof row])` 等で文字列化する。`as string` でなく String() を使う。
4. **手本**: routes/org/tree/route.ts（単純 GET）, routes/org/members/[dept_code]/route.ts（動的 param GET）。

## 対象

担当ドメインの routes/<command>/route.ts のうち `api(` を import・使用している全ファイル（grep "api(" routes/<domain>）。

## 注意

- api の実 route のパス・メソッドは /Users/i/open-karte/api/src/app.ts のチェーン登録（.get("/path", ...) / .post(...)）が正。hc のプロパティチェーンはそのパスに対応する。
- api の route が返すレスポンス形（snake_case のインラインオブジェクト）が hc の推論型になる。render のカラム名（cols）はその snake_case に一致するはず。
- help 分岐（c.req.valid("json").help）と引数チェック（400）は維持。
- POST の body は api の route の zValidator("json", ...) の形に合わせる（snake_case）。
- 型チェック（bunx tsc）は cross-package の api の `@/` 解決でエラーが出る場合があるが、ランタイム（bun cli/index.ts <cmd> --help）が動けばよい。tsc の cross-package エラーは別途設定で扱う。
- @/ 絶対パス, const のみ, セミコロンは付けてよい（cli は semi:false）。

## 完了確認

- grep "api(" routes/<domain> で旧 api() 呼び出しが残らない（createClient + client.xxx.$get/$post に置換）。
- bun /Users/i/open-karte/cli/index.ts <domain> <command> --help が各コマンドで正しいヘルプを返す（ランタイム動作）。

## 報告

hc 化したコマンド数、変換したパス、ランタイム確認結果を報告する。
