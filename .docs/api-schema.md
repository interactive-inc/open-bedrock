# API Schema

api ワークスペース(Hono on Cloudflare Workers)が提供する HTTP API。cli と web はこの api を叩く。

## 認証方式

ログインで JWT トークンを取得し、以降のリクエストは Authorization ヘッダに Bearer トークンを付与する。api は jose でトークンを検証する。

## エンドポイント構造

ドメインごとにパスを分ける。一覧や詳細の取得は GET、作成や提出や承認などの操作は POST、レコードの更新は PUT(一部 PATCH)、削除は DELETE を用いる。

ルートの一覧は api/src/app.ts を、各エンドポイントの入出力は api/src/interface 配下の実装を参照する。
