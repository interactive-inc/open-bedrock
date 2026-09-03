# api

HTTP API。Hono と Cloudflare Workers と D1 で構成する。

社内事務手続きのドメイン（attendance, career, expense, employee, org, knowledge ほか）を interface / application / domain / infrastructure の 4 層で構成する。

## アーキテクチャ

各層の役割は次のとおり。

- `src/domain/<domain>/` … エンティティ（Zod スキーマ）、リポジトリ interface、純粋ロジック
- `src/application/<domain>/` … ユースケース。依存を引数で受ける関数
- `src/infrastructure/<domain>/` … D1 リポジトリ実装。コンストラクタは `{ env, deps }`
- `src/interface/<domain>/<path>/route.ts` … HTTP 境界。Next.js App Router 記法。route 内でその場 DI する

リクエストスコープの値（認証済みの本人、現在時刻）は Hono の contextStorage（`src/context.ts`）で interface 層からのみ参照する。下位層へは引数で渡す。

## セットアップ

依存をインストールする。

```sh
bun install
```

## データベース

D1 を作成し、出力された database_id を `wrangler.jsonc` の d1_databases に設定する。

```sh
bunx wrangler d1 create bedrock
```

マイグレーション（`migrations/*.sql`）を適用する。

```sh
bun run db:migrate:local
bun run db:migrate
```

本番Workerは必ず次の正規コマンドでdeployする。remote D1 migrationが1本でも失敗した場合は
`wrangler deploy`へ進まない。previewはproduction DBを変更せずversion uploadだけを行う。

```bash
bun run deploy
bun run deploy:preview
```

初期 seed（`seeds/<domain>.sql` を依存順に投入）を流す。

```sh
bun run db:seed:local
bun run db:seed
```

## シークレット

JWT 署名鍵を secret として登録する。

```sh
bunx wrangler secret put JWT_SECRET
```

## 開発

開発サーバ、テスト、Cloudflare Workers 向けビルドは次のコマンドで行う。

```sh
bun run dev
bun test
npm run build
```

## マイグレーションと seed の追加

スキーマは `migrations/` に SQL で置く。基盤テーブル（employees や departments など）を先に作るため `0001_employee.sql` や `0002_org.sql` のように番号で順序付けし、各ドメインは `migrations/<domain>.sql` を追加する。

seed は `seeds/<domain>.sql`（INSERT のみ）に置く。`scripts/seed.sh` が依存順に適用する。巨大な単一ファイルは作らず、個別ファイルを順次流す。

seed の整合性は `bun scripts/verify-seed.ts` で確認できる。全 migration と全 seed をインメモリ SQLite に流し、テーブルごとの行数を表示する。

## テスト

テストは `src/interface/shared/test/` のヘルパで、`migrations/` のスキーマを bun:sqlite に流し、TS seed を投入して route を E2E で叩く。本番は Cloudflare D1、テストはインメモリ SQLite を使う。
