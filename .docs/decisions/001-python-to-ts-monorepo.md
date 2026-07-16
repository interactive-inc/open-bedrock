# Python 実装から TypeScript モノレポへ移行する

規範性: 根拠記録。状態は historical。現在の仕様は仕様正本とコードを優先する。

## 状況

`historical`

初期の open-karte はサーバ(FastAPI)と CLI と MCP サーバを Python で実装していた。これを api と cli と web からなる TypeScript の bun モノレポへ移行することにした。移行の動機そのものはコードからは読み取れないため、ここでは観測された事実と決定を記録する。

## 判断

api と cli と web を bun workspaces のモノレポにまとめ、api は Hono と Cloudflare Workers、cli は Hono と bun、web は Next.js で実装する方針に揃える。cli は引数をローカル HTTP リクエストに変換し、内部の Hono ルートを経て接続先 api を叩く。cli の設定は ~/.karte/config.json に保存する。

## 理由

- Python 実装の継続: 却下。移行理由の詳細はコードから読み取れないが、TypeScript への一本化が選ばれた
- TypeScript モノレポの採用: api と cli で同一の Hono ルーティング基盤を共有でき、bun で統一的に実行できる。web も含めて Zod による入力検証と型を共有しやすい

## 結果

- 旧 Python 実装は廃止し、api と cli と web は本リポジトリの TypeScript モノレポに実装済み。各機能の概要は [機能一覧](../features.md)、システム構成は [アーキテクチャ](../architecture.md) を参照
- cli は引数をローカル HTTP リクエストに変換し、内部の Hono ルートを経て api を叩く設計になった
- cli の設定ファイルは ~/.karte/config.json（旧実装の ~/.talent から変更）
- トレードオフ: api を Cloudflare Workers と D1 前提に寄せたため、ランタイムやデータ層の選択肢がその制約に縛られる
