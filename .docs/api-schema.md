# API 規約

api ワークスペースが Cloudflare Workers 上の Hono で提供する HTTP API の規約を記述する。この文書は全ルートや全入出力を固定したスキーマではない。実装されているルートの正本は api/src/app.ts、各入出力の正本は api/src/interface 配下、利用可能な能力と提供面は [[capability-map|機能網羅表]] である。

## 認証方式

POST /auth/login でアクセストークンとリフレッシュトークンを取得する。以降のリクエストは Authorization ヘッダに Bearer 形式のアクセストークンを付与する。POST /auth/refresh はリフレッシュトークンをローテーションし、新しいトークン対を返す。

認証済みであることは操作許可を意味しない。API はシステム権限、対象との関係、案件割当、状態などを判定する。規範となる合成規則は [[authorization-model|認可モデル]] を参照する。

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

型付きクライアントは api/app の AppType を type-only で参照し、各クライアント側で hc を生成する。api/app から実行時の値を取り込むと API の全ルートをクライアントバンドルへ引き込むため禁止する。

ルートを追加したときは api/src/app.ts へ登録し、型を再生成する。CLI ルートを追加したときは cli/app/index.ts にも登録する。ドメインが API、Web、CLI に存在していても操作単位で同等とは限らないため、提供面の説明では実際の入口を確認する。
