# cli (karte)

社内事務手続きのための CLI。Hono + bun 製。

引数をすべて POST のローカル HTTP リクエストに変換し、`cli/app` の Hono アプリを
`app.request()` で処理する。各ハンドラは `~/.karte/config.json` のトークンで api を叩く。

## 使い方

```sh
bun install
bun index.ts --help          # ヘルプ
bun index.ts login --email you@example.com --password ****
bun index.ts whoami
bun index.ts app inbox
```

`karte` として bin 登録済み（`bun link` で PATH に通す）。
接続先は環境変数 `KARTE_API`（既定 `http://127.0.0.1:8787`）で上書きできる。

## 構成

- `index.ts` … エントリ。引数 → `toRequest` → `app.request()`。help/404 フォールバック
- `app/` … コマンド群。`<command>/.../route.ts` で定義し、`app/index.ts` が集約する
- `lib/` … 共通処理（引数変換 router、http クライアント、config 読み書き、表示整形）

コマンドの一覧は `index.ts` のヘルプを、各コマンドの入出力は `app/` 配下の実装を参照する。

## 社員の指定

一覧系コマンドで他者を指定するフラグは、叩く API のパラメータに合わせて 2 種類ある。どちらも管理者・マネージャ向けの任意フラグで、省略時は本人が対象になる。

- `--employee-id <id>` … 数値の社員 ID。`goal` / `attendance` の一覧で使う（API が `employee_id` を受けるため）
- `--employee-code <code>` … 文字列の社員コード。`training` / `shift` / `org` などで使う（API が `employee_code` を受けるため）
