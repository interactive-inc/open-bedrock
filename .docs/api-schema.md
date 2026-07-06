# API Schema

api ワークスペース(Hono on Cloudflare Workers)が提供する HTTP API。cli と web はこの api を叩く。

## 認証方式

ログイン(POST /auth/login)でアクセストークン(JWT、1時間)とリフレッシュトークン(7日)を取得し、以降のリクエストは Authorization ヘッダに Bearer トークンを付与する。アクセストークンの失効時は POST /auth/refresh でローテーション再発行する。api は jose でトークンを検証する。

認可は permission ベース(deny-by-default)で、権限のないリクエストは 403 を返す。考え方は [[roles-and-permissions|ロールと権限]] を参照する。

## エンドポイント構造

ドメインごとにパスを分ける。一覧や詳細の取得は GET、作成や提出や承認などの操作は POST、レコードの更新は PUT(一部 PATCH)、削除は DELETE を用いる。

URL は次の規約で統一する。

- 資源は複数形の名詞(/employees、/surveys、/application-templates、/oneonones)
- 自分のリソースは /me サブリソース(/expenses/me、/leave/balance/me)
- 承認待ち一覧は /inbox サブリソース(/expenses/inbox、/leave/requests/inbox)
- 状態遷移は資源配下の動詞 POST(/applications/:id/approve、/review-cycles/:cycle_id/open、/attendance/clock-in)

## リスト系レスポンス

limit と offset を受けるリスト系 GET は、配列ではなく data と total を持つオブジェクトを返す。total は絞り込み条件適用後・limit/offset 適用前の総件数で、クライアントはこれで次ページの有無を判定する。

```json
{ "data": [], "total": 0 }
```

ルートの一覧は api/src/app.ts を、各エンドポイントの入出力は api/src/interface 配下の実装を参照する。
