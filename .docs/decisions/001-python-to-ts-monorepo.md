# 001-Python から TypeScript モノレポへ移行する

最終更新: 2026-05-31

## 状況

[[index|open-karte]]の旧構成は Python 製だった。api・cli・web を1つの基盤として束ね、Claude などの AI から CLI でも操作できることを目指す中で、言語と実行環境を再選定する必要があった。

## 判断

Python 構成を廃し、TypeScript のモノレポへ移行する。api は Hono + Cloudflare Workers、cli は Hono + bun、web は Next.js + React で構成し、3ワークスペースを bun workspaces で束ねる。

## 理由

- api と cli で同一のルーティング基盤(Hono)を共有でき、同じ業務を複数インタフェースから実行する原則に沿う
- web と api を同一言語にすることで型と入力検証(Zod)を端から端まで通せる
- 却下した選択肢: Python を維持する。言語が web と分かれ、ルーティング基盤を共有できず、型の一貫性も得にくいため却下した
- 却下した選択肢: api と web を別リポジトリに分ける。同じ業務を複数インタフェースから提供する設計でコードと型の共有が難しくなるため却下した

## 結果

- 全ワークスペースが TypeScript に統一され、型と検証を共有できる
- トレードオフ: Cloudflare Workers の制約(ランタイム・実行時間)に api の設計が縛られる
- 本決定時点では雛形のみで実コードは未実装。具体的な機能は[[backlogs/index|バックログ]]から着手する
