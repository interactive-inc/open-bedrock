# D1 + その場DI 移行ガイド（コンテナ廃止・ユースケース関数化）

各ドメインを「D1 リポジトリ + ユースケース関数 + route その場DI」へ移行する。`org` と `employee` が完成済みの**手本**。必ず手本を読んでから着手すること。

## 設計（確定事項）

1. **コンテナ廃止**: `getContainer()` を使わない。`container.ts` / `build-container.ts` / `build-<domain>-use-cases.ts` / `<Domain>UseCases`（束ね役クラス）は削除対象。
2. **ユースケースは関数**（DIしない）: `class GetXxx { constructor(props){} invoke() }` をやめ、`export async function getXxx(props: Props, ...args)` の関数にする。依存（リポジトリ等）は第1引数 `props` で受け取る。複数のユースケースが同じ Props を共有してよい。
3. **リポジトリは D1 実装**: `infrastructure/<domain>/d1-<x>-repository.ts`。
   - コンストラクタは必ずオブジェクト1個 `constructor(private readonly props: Props)` で、`Props = RepositoryProps<Deps>`（`@/infrastructure/shared/repository-props`）。`type Props = RepositoryProps`（deps 不要なら）か `RepositoryProps<{ ... }>`。
   - `Object.freeze(this)`。
   - クエリは `this.props.env.DB.prepare(sql).bind(...).all()/.first()`。
   - 行（snake_case）は Zod schema で safeParse し、`to<Entity>(row)` で camelCase ドメインへ変換。parse 失敗は `Error` を返す（throw 禁止）。
   - `T | Error` を返し instanceof で判別。
4. **route はその場DI**: route.ts 内で `new D1XxxRepository({ env: c.env, deps: {} })` を組み、ユースケース関数に渡す。`getContainer()` 参照を全て置換。
5. **リクエストスコープ値**: `now()` / `getViewer()` / `getJwtSecret()`（`@/context`）は interface 層でのみ使い、ユースケース関数へ引数で渡す（既存どおり）。
6. **in-memory リポジトリは不要**: テストは bun:sqlite の D1 スタブで E2E する（下記）。既存の `in-memory-<x>-repository.ts` は削除。
7. ID 採番が要る create 系は `crypto.randomUUID()`。

## 手本ファイル（org / employee）

- ユースケース関数: `src/application/org/get-org-tree.ts`, `get-org-members.ts`（第2引数で code を受ける例）, `get-org-reporting-line.ts`
- D1 リポジトリ: `src/infrastructure/org/d1-org-department-repository.ts`（findAll/findByCode + Zod row + to変換）, `d1-org-membership-repository.ts`, `d1-department-name-lookup.ts`, `src/infrastructure/employee/d1-employee-repository.ts`（検索・LIKE・count の例）
- 共通: `src/infrastructure/shared/repository-props.ts`（`RepositoryProps<Deps>`）
- route その場DI: `src/interface/org/tree/route.ts`, `departments/[code]/members/route.ts`, `reporting-line/[employee_code]/route.ts`

## D1 スキーマ（migrations）

- `migrations/NNNN_<domain>.sql` を新規作成（番号は既存と衝突しないよう 0002, 0003... ドメインごと）。`CREATE TABLE IF NOT EXISTS` で各テーブルを定義。
- カラムは snake_case。既存の seed（`src/infrastructure/seed/seed-*.ts`）とドメインエンティティ（`src/domain/<domain>/*.ts`）から構造を導出。
- `migrations/0001_org_and_employee.sql` が departments/org_departments/org_memberships/employees の手本。
- 主キー・必要な INDEX（検索キー）も付ける。

## テスト（bun:sqlite の D1 スタブで E2E）

`src/interface/<domain>/<domain>-route.test.ts` を作る。手本 `src/interface/org/org-route.test.ts` に倣う:

- `createD1TestDatabase(loadSchema())` で全 migration を流した in-memory SQLite を作る（`@/interface/shared/test/d1-test-database`, `load-schema`）。
- 既存 TS seed を snake_case 行に変換し `seedD1(db, "<table>", rows)` で投入（`@/interface/shared/test/seed-d1`）。
- `requestWithContext({ db, jwtSecret, path, token, method?, body?, now? })` で叩く（`@/interface/shared/test/request-with-context`。db は必須、container 引数は廃止）。
- 旧テストの期待値（status・レスポンス形・権限・404/401）をそのまま移植。
- create 系で UUID を使う場合は id をスキーマ検証（uuid 形式）で受ける。

## 制約

- `src/app.ts` / `src/index.ts` / `src/container.ts` / `src/infrastructure/build-container.ts` は **編集しない**（共有・競合）。コンテナ廃止に伴うこれらの最終調整は統合担当が行う。各ドメインは自分の route/usecase/repository/migration/test だけ触る。
- @/ 絶対パス、type のみ(interface/enum/any/as 禁止)、throw 禁止(T|Error)、1ファイル1関数/1クラス、const のみ、destructuring 禁止、セミコロンは付けてよい（fmt が消す）。
- 個人情報・固有名詞・認証情報を新たに持ち込まない（AGENTS.md）。seed は既存の汎用値を使う。
- 自分のドメインの route.ts で `getContainer` 参照が残らないこと（全てその場DIに）。
- ユースケースのクラス（`*-use-cases.ts` 束ね役、`Get*`/`*` クラス）は関数化後に削除。`build-<domain>-use-cases.ts`、`in-memory-*-repository.ts` も削除。

## 報告（schema）

作成/削除したファイル、追加した migration テーブル、テスト結果（pass/fail）、残課題を報告する。app.ts/container 等は触らず、もし getContainer 以外に共有ファイル変更が必要なら notes に記載。
