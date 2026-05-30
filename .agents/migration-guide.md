# api ドメイン移植ガイド（旧 → 4層 + DI + ALS + Next.js風route.ts）

各ドメインを以下の構造へ移植する。`org` が完成済みの**手本**。必ず手本を読んでから着手すること。

## レイヤー（トップレベル）

- `src/domain/<domain>/` … エンティティ(Zodスキーマ+型)、リポジトリ **interface**(type)、純粋ロジック(関数)
- `src/application/<domain>/` … ユースケース **クラス**（constructor DI）と束ね役 `<Domain>UseCases` クラス
- `src/infrastructure/<domain>/` … リポジトリ実装 **クラス**、`build-<domain>-use-cases.ts`(composition root)
- `src/infrastructure/seed/` … seed（domain型を参照）
- `src/interface/<domain>/<path>/route.ts` … HTTP境界。Next.js App Router記法。末端に専用のレスポンス変換/スキーマをコロケーション

## 手本ファイル（org）

- domain: `src/domain/org/*.ts`, `src/domain/auth/token-payload.ts`, `src/domain/employee/*.ts`
- application: `src/application/org/*.ts`（`get-org-tree.ts` がユースケースクラスの形、`org-use-cases.ts` が束ね役）
- infrastructure: `src/infrastructure/org/*.ts`（`in-memory-*-repository.ts` がクラス実装、`build-org-use-cases.ts` が composition root）
- interface: `src/interface/org/tree/route.ts`(静的), `src/interface/org/departments/[code]/members/route.ts`(動的セグメント), 各 `*-response.ts`(末端コロケーション変換)
- 共有: `src/context.ts`(ALS), `src/container.ts`, `src/factory.ts`, `src/interface/shared/*`
- テスト: `src/interface/org/org-route.test.ts`（`requestWithContext` + `buildContainer` を使う）

## 設計ルール（確定事項）

1. **route.ts は `factory.createHandlers(verifyBearer, async (c) => {...})` を default export**。`deps` 引数は取らない。
2. **ユースケースは `getContainer().<domain>.<useCase>.invoke(...)` で取得**して呼ぶ。
3. **ALS にはリクエスト情報のみ**（tokenPayload/now/jwtSecret）。本人は `getViewer()`、現在時刻は `getContext().now()`。
4. **リポジトリ実装・ユースケースはクラス**。`constructor(private readonly props: Props)` + `Object.freeze(this)`。引数4個以上は `props: Props`。
5. **ユースケース出力は application のView型**（例 `OrgMemberView`）。snake_case への変換は interface 層の末端 `*-response.ts` で行う。
6. **NotFound 等のドメイン的失敗は判別可能な型**（例 `{ reason: "..._not_found" }`）で返し、Error と区別。route で 404 に変換。
7. **新規 create の ID は `crypto.randomUUID()`**。既存の連番内部キー(`id:number`)は維持。
8. **seed は汎用値**（`you+xxx@example.com`、英語の汎用名）。実在の固有名詞・個人情報・認証情報を持ち込まない（AGENTS.md）。元seedに日本語名があれば英語汎用名に置換。
9. **import は `@/` 絶対パスのみ**。バレルファイル禁止。1ファイル1関数/1クラス。ファイル名=ケバブケース。
10. **throw 禁止、`T | Error` を返し instanceof で判別**。
11. **セミコロンなし**（fmt が `semi:false`）。書くときは付けてよい（fmt が消す）。

## URL ↔ ファイルパス対応（Next.js記法）

- `GET /foo/bar` → `interface/<domain>/foo/bar/route.ts`（ディレクトリ末端に route.ts）
- 動的 `:code` → `[code]` ディレクトリ
- ドメインのルート(`/org`等のヘルプ的GET)は不要。CLIのヘルプはcli側の責務。
- 旧 route.ts の `app.get/post(path, ...)` を1つずつ route.ts に分解。

## app.ts への登録

`src/app.ts` に各 route.ts を import し、`app.<method>("<honoパス>", ...<route>)` で登録する。
`[code]` は `:code` に読み替える。**他ドメインの担当者と衝突するため、app.ts は最後にまとめて1人が統合**（移植エージェントは app.ts を編集せず、登録すべき行を成果物として報告する）。

## container 登録

`src/container.ts` の `Container` 型に `<domain>: <Domain>UseCases` を追加し、`src/infrastructure/build-container.ts` で `build<Domain>UseCases(...)` を呼んで登録する。
**これも衝突するため、移植エージェントは「Containerに追加する型」「build-containerに追加する生成式」を報告するだけ**にする。

## テスト

各ドメインに `src/interface/<domain>/<domain>-route.test.ts` を作り、`requestWithContext({container: buildContainer(), jwtSecret, path, token})` で叩く。
旧 `*-route.test.ts` の期待値を新構造へ移植。seed を汎用値に変えた場合は期待値も合わせる。
