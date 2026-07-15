# 読み取り直叩き + レスポンスインライン化 ガイド

各ドメインを「読み取りは route から Drizzle 直叩き、レスポンスは route インライン、書き込みのみユースケース」に整える。`expense` が完成手本。

## 設計（確定）

1. **読み取り（GET）は route で `c.var.database` を直叩き**。read 専用ユースケース（list-_/get-_/search-\* で取得して view に変換するだけのもの）と、その View 型を削除する。
   - 単純取得: `c.var.database.select().from(table).where(and(...conditions))` → snake_case のオブジェクトに map → `c.json(body, 200)`。
   - 結合（申請者名など）: `c.var.database.select({ x: table, name: employees.name }).from(table).leftJoin(employees, eq(employees.id, table.employeeId)).where(...)`。row.x.field と row.name で参照。
   - 手本: src/interface/expense/me/route.ts（単純）, src/interface/expense/[id]/route.ts と inbox/route.ts（join + 権限）。
2. **レスポンスは route インライン**。`*-response.ts`（toXxxResponse + Zod schema）を廃止し、route 内で snake_case のオブジェクトリテラルを直接組んで c.json する。変数名は `body` が既存（c.req.valid("json")）と衝突する場合 `responseBody` を使う。
3. **書き込み（POST/PUT/DELETE）はユースケース + リポジトリを維持**。ただし route の `toXxxResponse(result)` はインライン化する（手本: src/interface/expense/route.ts の submit, [id]/approve, [id]/reject）。
4. **テストの response schema 依存を解消**。テストが `import { xxxResponseSchema } from ".../*-response"` を使っている場合、response.ts を消すと壊れる。テスト側で同等の Zod スキーマをテストファイル内に定義するか、レスポンスのフィールドを直接 expect で検証する形に変える。挙動・期待値は不変に保つ。
5. **クエリ schema の型整合**: Drizzle カラムが `.$type<...>()`（enum）を持つ場合、route で `eq(table.status, query.status)` するには query schema 側も `z.enum([...])` にする（string だと overload エラー）。
6. **ドメインモデルのクラス化**: src/domain/<domain> の z.infer のエンティティ（リクエスト/クエリ/view/lookup 型を除く実体）を class 化する（手本 src/domain/org/org-department.ts: const zProps = z.object(...); type Props = z.infer<typeof zProps>; export class X implements Props { readonly f!: Props["f"]; constructor(private readonly props: Props){ zProps.parse(props); Object.assign(this, props) } update\*(v){ return new X({...this.props, v}) } }）。リポジトリのマッパーは new XEntity({...}) を返す。seed がエンティティ型を使っていれば seed 側を独立プレーン型にする。

## 制約

- @/ 絶対パス、type のみ、throw 禁止（T|Error）、destructuring 禁止、1ファイル1クラス、const のみ、セミコロンは付けてよい。
- 書き込みの整合性（権限・存在確認・トランザクション的更新）は維持。read で消すのは「DB を1〜数回叩いて整形するだけ」のユースケース。複雑な集計・ツリー構築など DB を叩かない純粋ロジックは domain に残し route から呼ぶ。
- 削除する read ユースケース/view/response が他から参照されていないこと（grep で確認）。テストからの参照は上記4で解消。
- 個人情報を持ち込まない。

## 完了確認

- bun test src/interface/<domain>/<domain>-route.test.ts が pass。
- grep で src/application/<domain> に list-_/get-_/search-_ の「取得だけ」ユースケースが残っていないこと、src/interface/<domain> に _-response.ts が残っていないこと。
- このドメインの route から \*-response import が消えていること。

## 報告

削除したファイル（read ユースケース/view/response）、クラス化したモデル、テスト修正、テスト結果を報告する。
