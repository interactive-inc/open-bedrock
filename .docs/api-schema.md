# API Schema

api ワークスペース(Hono on Cloudflare Workers)が提供する HTTP API。cli と web はこの api を叩く。

## 認証方式

ログインで JWT トークンを取得し、以降のリクエストは Authorization ヘッダに Bearer トークンを付与する。api は jose でトークンを検証する。

## エンドポイント構造

ドメインごとにパスを分ける。一覧や詳細の取得は GET、作成や提出や承認などの操作は POST、レコードの更新は PUT(一部 PATCH)、削除は DELETE を用いる。

URL は次の規約で統一する。

- 資源は複数形の名詞(/employees、/surveys、/application-templates、/oneonones)
- 自分のリソースは /me サブリソース(/expenses/me、/leave/balance/me)
- 承認待ち一覧は /inbox サブリソース(/expenses/inbox、/leave/requests/inbox)
- 状態遷移は資源配下の動詞 POST(/applications/:id/approve、/review-cycles/:cycle_id/open、/attendance/clock-in)

ルートの一覧は api/src/app.ts を、各エンドポイントの入出力は api/src/interface 配下の実装を参照する。
