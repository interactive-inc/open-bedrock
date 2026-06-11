# シードデータ

このディレクトリの SQL ファイルはローカル開発およびテスト専用のサンプルデータです。

全従業員が共通の既知パスワード（`password`）でハッシュされており、本番環境に投入してはなりません。

## ローカルへの投入方法

ガードスクリプト `guard-local-only.sh` を経由して実行してください。`--remote` フラグが指定されると拒否されます。

```bash
bash api/seeds/guard-local-only.sh open-karte api/seeds/employee.sql
```

直接 wrangler を実行する場合も `--remote` を付けないでください。

## 本番環境の初期化について

本番環境の初期データは運用手順書に従い、個別に安全なパスワードを設定した上で投入してください。このディレクトリの SQL をそのまま本番に適用することは禁止です。

`guard-local-only.sh` は `--remote` フラグおよび `WRANGLER_ENV=production` / `CLOUDFLARE_ENV=production` 環境変数を検出して実行を中断します。
