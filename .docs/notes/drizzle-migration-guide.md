# Drizzle + Context注入 移行ガイド

各ドメインを「Drizzle ORM + Context 注入」へ移行する。`org` と `employee` が完成済みの**手本**。
参考実装は `~/open-stack-app-drizzle`（同一アーキテクチャ）。必ず手本を読んでから着手すること。

## 設計（確定事項）

1. **スキーマはドメインごとに `src/infrastructure/<domain>/schema.ts`** に定義する。Drizzle の `sqliteTable` でテーブルを定義し、`InferSelectModel` で行型を出して export する。
   - 例（手本）: `src/schema.ts`（現状 employees / departments / orgDepartments / orgMemberships を直接定義）。新ドメインは `src/infrastructure/<domain>/schema.ts` に自分のテーブルを書き、`src/schema.ts` の集約に統合担当が追加する（下記「共有ファイル」参照）。
   - カラムは snake_case を `text("snake_case")` / `integer("snake_case")` の第1引数で指定し、プロパティ名は camelCase。
   - リポジトリは `import { xxxTable } from "@/infrastructure/<domain>/schema"` で自分のテーブルを使う。
2. **リポジトリは Context 注入**: `constructor(private readonly c: Context)` のみ（`{ env, deps }` 廃止）。`this.c.var.database`（Drizzle）でクエリビルダを使う。
   - 手本: `src/infrastructure/org/d1-org-department-repository.ts`, `d1-org-membership-repository.ts`, `d1-department-name-lookup.ts`, `src/infrastructure/employee/d1-employee-repository.ts`（検索 like/and/or, count, sql LOWER の例）。
   - クエリは `this.c.var.database.select().from(table).where(eq(...))` 等。生 SQL（`env.DB.prepare`）は廃止。
   - `try { ... } catch (error) { return error instanceof Error ? error : new Error("...") }` で `T | Error` を返す（throw 禁止）。
   - 行（Drizzle の InferSelectModel）→ ドメインエンティティ（camelCase）への変換関数 `to<Entity>(row)` を付ける。
   - INSERT/UPDATE は `this.c.var.database.insert(table).values({...})` / `.update(table).set({...}).where(...)`。create の id は `crypto.randomUUID()`。
3. **route はその場 Context 注入**: `new D1XxxRepository(c)` をユースケース関数（または route 内）に渡す。`new D1Xxx({ env: c.env, deps: {} })` を `new D1Xxx(c)` に置換。
4. **認証済みの本人は `c.var.session`**（`SessionPayload | null`）。`getViewer()`（@/context）を使っている route は `c.var.session` に置き換える。null なら 401。`getViewer()` は employeeId / email / role を持つ（SessionPayload = TokenPayload）。
5. **現在時刻**: `now()`（@/context ラッパ）は廃止。route で必要なら `c.env.NOW ?? new Date().toISOString()` を直接書いてユースケースに渡す（ラッパ関数は作らない）。
6. **`@/context`（context.ts ラッパ）と `inject-clock` は使わない**。新規に import しない。
7. **ユースケース**: 既存の関数形（依存を引数で受ける）を維持してよい。リポジトリだけ Drizzle 実装に差し替わる。ユースケースのシグネチャ（リポジトリ interface を受ける）は変えない。
8. **domain のリポジトリ interface は残す**（実装が満たす）。Zod の行スキーマ（旧 D1 実装の rowSchema）は不要になるので削除。

## 共有ファイル（編集しない・報告する）

- `src/schema.ts` … 全テーブルの集約 export（`drizzle(db, { schema })` に渡す）。**編集せず**、自ドメインの `src/infrastructure/<domain>/schema.ts` から re-export すべきテーブル名を報告する。統合担当が `src/schema.ts` に `export * from "@/infrastructure/<domain>/schema"` 相当の追加と `schema` オブジェクトへのキー追加を行う。
- 自ドメインの `src/infrastructure/<domain>/schema.ts` は**自分で作る**（競合しない）。
- `src/app.ts`, `src/env.ts`, `src/lib/factory.ts` … 触らない。

## テスト

テストヘルパ（`requestWithContext`）は変更不要。`c.env.DB` に bun:sqlite の D1 互換スタブを入れ、database-middleware が `drizzle(c.env.DB, {schema})` で包む。

- 既存テストの seedD1 / createD1TestDatabase / loadSchema はそのまま使える（migration SQL でテーブルを作り、seed を入れる）。
- ただし schema.ts に自ドメインのテーブルが登録されていないと Drizzle の型が通らない（→ テーブル定義は報告し、統合で schema.ts に入る）。
- テストの期待値（status・レスポンス形・401/404・created_at 固定）は維持。`getViewer`→`c.var.session` 化で挙動は変わらない。

## 制約

- @/ 絶対パス、type のみ、throw 禁止（T|Error）、destructuring 禁止、1ファイル1クラス、const のみ、セミコロンは付けてよい。
- 個人情報・固有名詞・認証情報を新たに持ち込まない。
- 自ドメインの route から `getContainer`・`{ env, deps }`・`env.DB.prepare`・`@/context`・`getViewer`・`now()` が消えていること。
- 完了後 `bun test src/interface/<domain>/<domain>-route.test.ts` を実行（schema.ts 未統合だと型は通らないが、ロジックの正しさは確認できる範囲で）。

## 報告（schema）

作成/変更/削除ファイル、`src/schema.ts` に追加すべきテーブル定義（sqliteTable のフルコード）と `schema` オブジェクトへの追加キー、テスト結果、残課題を報告する。
