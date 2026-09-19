# シードデータ

このディレクトリの SQL ファイルはローカル開発およびテスト専用のサンプルデータです。

全従業員が共通の既知パスワード（`password`）でハッシュされており、本番環境に投入してはなりません。

## ローカルへの投入方法

ガードスクリプト `guard-local-only.sh` を経由して実行してください。`--remote` フラグが指定されると拒否されます。

```bash
bash api/seeds/guard-local-only.sh bedrock api/seeds/employee.sql
```

全ファイルをまとめて投入する場合は `cd api && bun run db:seed:local` を使ってください（依存順に 1 ファイルずつ適用します）。

直接 wrangler を実行する場合も `--remote` を付けないでください。

## 本番環境の初期化について

本番環境の初期データは運用手順書に従い、個別に安全なパスワードを設定した上で投入してください。このディレクトリの SQL をそのまま本番に適用することは禁止です。

`guard-local-only.sh` は `--remote` フラグおよび `WRANGLER_ENV=production` / `CLOUDFLARE_ENV=production` 環境変数を検出して実行を中断します。

## 主キー UUID の採番規約 (Issue #1311)

seed の主キーは RFC 9562 に準拠した UUID にする。version は 7、variant は 0b10 を
満たす必要があり、`20000000-0000-0000-0000-000000000001` のような「UUID の形をした
連番」は DB の CHECK 制約が拒否する。

再現性のため先頭 48bit には生成時刻を入れず、下表の固定値を使う。table ごとに
prefix を変えてあるので、ID を見ただけでどの table のものか分かる。

```
01900001-0000-7000-8000-<連番>  announcement
01900002-...                    resignation
01900003-...                    one-on-one
01900004-...                    rental
01900005-...                    room
01900006-...                    life-event
01900007-...                    business-trip
01900008-...                    family-care-leave
01900009-...                    certificate-request
0190000a-...                    antisocial-check
0190000b-...                    asset (stocktake)
0190000c-...                    governance
```

「存在しない ID」を表す fixture は UUID でなくてよい。`ffffffff-ffff-ffff-ffff-ffffffffffff`
のように、CHECK にも Zod にも拒否される値をあえて使う。
