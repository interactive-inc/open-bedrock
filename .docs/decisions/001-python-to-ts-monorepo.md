# Python 実装から TypeScript モノレポへ移行する

## 状況

初期の open-karte はサーバ(FastAPI)と CLI とMCPサーバを Python で実装していた。現行リポジトリでは api と cli と web を TypeScript の bun モノレポとして構成し直す移行が進んでいる。移行の意思決定の背景はコードからは読み取れないため、ここでは観測された事実のみを記録する。

## 判断

api と cli と web を npm workspaces のモノレポにまとめ、CLI は Hono と bun、API は Hono と Cloudflare Workers、web は Next.js で実装する方針に揃える。CLI は旧 talent.py と同じく ~/.talent/config.json とバックエンド API を前提とする設計を踏襲する。

## 理由

- Python 実装の継続: 未確認。移行理由はコードから読み取れない
- TypeScript モノレポの採用: API と CLI で同一の Hono ルーティング基盤を共有でき、bun で統一的に実行できる

## 結果

- CLI は引数をローカル HTTP リクエストに変換し Hono ルートで処理する設計になった。詳細は [[features|機能一覧]] を参照
- api と web は現状スキャフォールドで、業務機能は未実装。CLI が叩くバックエンド本体はこのリポジトリに含まれない
- トレードオフ: 旧 Python 実装と新 TypeScript 実装が併存する移行期にあり、両者の統合方針は未確認
