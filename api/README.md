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

開発用の初期 seed（`seeds/<domain>.sql` を依存順に投入）はローカルD1にのみ流す。

```sh
bun run db:seed:local
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

開発用seedは `seeds/<domain>.sql` に置く。`scripts/seed.sh` が依存順にローカルへ適用する。公開Company履歴の初期化には `company-public-workforce.sql` を使う。巨大な単一ファイルは作らず、個別ファイルを順次流す。

seed の整合性は `bun scripts/verify-seed.ts` で確認できる。全 migration と全 seed をインメモリ SQLite に流し、テーブルごとの行数を表示する。

## テスト

テストは `src/interface/shared/test/` のヘルパで、`migrations/` のスキーマを bun:sqlite に流し、TS seed を投入して route を E2E で叩く。本番は Cloudflare D1、テストはインメモリ SQLite を使う。

## 添付のバックアップと消去の運用

添付本体は `ATTACHMENTS` バケットへ暗号文だけを書く。復号鍵（DEK）は `ATTACHMENT_KEKS` の KEK で包んで D1 に置く。バックアップ先へ平文を渡さないため、presigned URL や平文の書き出しは使わない。

### 未紐付け添付の掃除

`ATTACHMENT_PURGE_SCHEDULE_ENABLED="true"` を設定し、配備先の `triggers.crons` で Worker の定期起動を登録する。一回の起動で最大100件を回収し、残りは次回に回す。定期起動を使わない配備では、`system:admin` を持つ Account で `POST /system/attachments/purge-unlinked` を定期的に呼ぶ。

### D1 のバックアップ

D1 の Time Travel（標準で30日のポイントインタイム復元）を一次手段にする。長期保管が必要な場合は `wrangler d1 export` を運用側のスケジューラで定期実行し、出力を暗号化して保管する。export には包まれた DEK が含まれるため、KEK と同じ場所に置かない。

監査 CSV の出力（`POST /company/audit-event-exports`）も同じ周期で実行し、D1 とは別の場所に保管する。

### 添付本体の複製

`bun run ops:attachments:replicate` は、`att/` の暗号文を S3 互換の別 storage へ同じ key で書く。設定が全て未設定なら何もしない。

- `ATTACHMENT_REPLICA_SOURCE_ENDPOINT`、`_BUCKET`、`_ACCESS_KEY_ID`、`_SECRET_ACCESS_KEY`、任意の `_REGION` に、複製元の読み出し用 credential を設定する
- `ATTACHMENT_REPLICA_TARGET_*` に、複製先の書き込み専用 credential を設定する。script は複製先を読み出さない。読み出し権限は復旧時にだけ払い出す
- `ATTACHMENT_REPLICA_STATE_FILE` に、前回の成功時刻を保存する file の path を設定する。file が無い初回は全件を書く
- `ATTACHMENT_REPLICA_OVERLAP_MINUTES`（既定60）だけ前回の成功時刻を遡り、境界の取りこぼしを防ぐ。重なった object は同じ暗号文で書き直す

途中で失敗した場合は状態 file を進めず、終了コード1で終わる。次回の実行が同じ範囲を書き直す。複製先の法域と世代の保持期限は運用者が選び、複製先の lifecycle 設定で古い世代を失効させる。

### 本体の実在照合

`bun run ops:attachments:reconcile` は、D1 の `pending` と `linked` の添付行を id 順に辿り、本体の実在を HEAD で確認する。object storage の全件 list は使わない。

- `ATTACHMENT_RECONCILE_STORAGE_*` に、HEAD ができる credential を設定する
- `ATTACHMENT_RECONCILE_STATE_FILE` に cursor を保存する。HEAD が全て完了した chunk の末尾だけへ進め、末尾まで辿ったら先頭へ戻す
- `ATTACHMENT_RECONCILE_CHUNK_SIZE`（既定100）と `ATTACHMENT_RECONCILE_MAX_CHUNKS`（既定10）で一回の量を決める
- `ATTACHMENT_RECONCILE_D1_BINDING`（既定 `bedrock`）と `ATTACHMENT_RECONCILE_WRANGLER_CONFIG`（既定 `wrangler.jsonc`）で照会先を決める
- `ATTACHMENT_RECONCILE_WEBHOOK_URL` を設定すると、欠損と連続失敗（`ATTACHMENT_RECONCILE_FAILURE_THRESHOLD`、既定3回）を JSON で POST する

欠損があれば添付 id だけを出力して終了コード2で終わる。照合は読み取りだけなので、失敗時は再実行だけで回復する。

### 復元後の消去の再適用

D1 を過去の時点へ復元すると、その後に破棄した DEK が行とともに戻る。復元の直後、利用者へ公開する前に次を行う。

- 未紐付け添付の掃除を実行し、復元で戻った期限切れの未紐付け行の鍵を再び破棄する
- 復元時点より後の監査 CSV を確認し、鍵破棄の記録があれば同じ対象の破棄をやり直す
- 照合を先頭から実行し、復元した行と本体の対応を確認する

紐付け済み添付の鍵破棄（承認を経た消去）は未実装である。現時点で消去を再現できるのは未紐付け添付の掃除だけである。

### 法令上の保存要件

この製品は変更不能な保存と閲覧記録を持つが、電子帳簿保存法その他の法令が求める保存要件への適合を判定せず、保証しない。適合の判断と、消去請求に応じるかの判断は運用する会社が行う。
