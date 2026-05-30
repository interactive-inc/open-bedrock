# web hc 化ガイド（apiRequest → hc<AppType>）

web の `src/lib/api/*.ts` の `apiRequest<T>(...)` 呼び出しを、型安全な `hc<AppType>` クライアントに置き換える。`get-skill-list.ts` が手本。

## 設計（確定）

1. **クライアント生成**: `import { createClient } from "@/lib/api/hc-client"`、関数内で `const client = await createClient()`。createClient は server session トークンを Authorization に載せた hc<AppType> を返す。
2. **呼び出しは hc メソッドチェーン**（cli と同じ規則）:
   - `GET /skills?q=&category=` → `client.skills.$get({ query: { q: query.q ?? undefined, category: query.category ?? undefined } })`
   - `GET /org/departments/:code/members` → `client.org.departments[":code"].members.$get({ param: { code } })`
   - `POST /survey/:id/responses` → `client["..."].$post({ param, json })`
   - ハイフン名セグメント（review-cycles 等）は `client["review-cycles"]`。
3. **レスポンス**: `const response = await client.xxx.$get(...)`、`if (response.ok === false) return new Error("...")`、`return response.json()`。
   - 返り値の型は AppType から推論される。関数の戻り型注釈（`Promise<ReadonlyArray<Skill> | Error>`）は**外す**（推論に任せる）か、互換なら残す。手本は外している。
   - 旧 `import type { Skill }` のような手動型 import で**もう使わなくなったもの**は削除。SearchQuery 等の入力型は残してよい。
4. **手本**: web/src/lib/api/get-skill-list.ts。

## 対象

`web/src/lib/api/` 配下で `apiRequest` を import・使用している全 `.ts`（get-_.ts, submit-_.ts 等。types/ 配下と api-request.ts 自体、hc-client.ts は除く）。

## 注意

- api の実パス・メソッドは /Users/i/open-karte/api/src/app.ts のチェーン登録が正。
- query の値は null を undefined に変換（hc は undefined を送信しない）。
- 関数のシグネチャ（引数）は維持し、呼び出し側（components）への影響を最小化。返り値型は推論に委ねてよい（多くは Promise<T | Error> のまま互換）。
- next の "use server"/server component 文脈は維持（createClient は getServerSession を使うので server 側で呼ぶ）。
- セミコロンは付ける（web は semi:true）。@/ 絶対パス。
- 型チェックの cross-package（api の @/ 解決）エラーは許容（ランタイム優先）。ただし lib/api 内の型整合は保つ。

## 完了確認

- 担当ファイルから `apiRequest` の import・使用が消える。
- `createClient` + `client.*.$get/$post` を使う。
- 手動型 import のうち未使用のものを削除。

## 報告

hc 化したファイル数、変換したパス、残課題を報告する。
