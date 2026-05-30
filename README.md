# open-karte

オープンソースの、社内事務手続きのためのセルフホスト基盤。
Claude などの AI エージェントから CLI で呼ばれることを前提に設計し、GUI はおまけ。

従業員台帳を土台に、「人・時間・物・お金・成長」をめぐる申請・承認・記録を束ねる。
扱うのは事実の記録・更新・検索と、それにまつわる申請ワークフローまで。
給与・税・労務のような重い計算や法的判定は持たず、外部に委ねる。

TypeScript のモノレポ。同じ業務を CLI と API、どちらからでも実行できる。

```
open-karte/
├── api/             # API サーバ (Hono / Cloudflare Workers)
├── cli/             # karte コマンド (Hono / bun)
├── web/             # Web UI (Next.js)
├── Makefile
├── package.json     # bun workspaces (api, cli, web)
└── README.md
```

ワークスペースの構成は以下のとおり。

- `api` … HTTP API。Hono + Cloudflare Workers (wrangler)
- `cli` … `karte` コマンド。引数を POST に変換しローカル Hono ルートで処理し、API を叩く
- `web` … Web UI。Next.js + React + Tailwind + shadcn

## 必要環境

- [bun](https://bun.sh)

## セットアップ

```sh
make dev      # bun install して portless で全アプリ起動
```

個別に動かす場合は `make help` を参照。

## CLI

```sh
cd cli
bun install
bun link          # karte コマンドを PATH に通す
karte --help
```

各コマンドは `~/.karte/config.json` のトークンで API を叩く。接続先は
環境変数 `KARTE_API`（既定 `http://127.0.0.1:8787`）で上書きできる。

```sh
karte login --email you@example.com --password ****
karte whoami
karte employee search --q プログラマ
karte app inbox
```

コマンド体系の詳細は [`cli/README.md`](cli/README.md) を参照。

## API

```sh
cd api
bun install
bun run dev        # wrangler dev
bun run deploy     # 本番デプロイ
```
