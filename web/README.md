# web

open-karte の Web UI。Next.js (App Router) + React + Tailwind + shadcn/ui。

API（`api` ワークスペース）に HTTP で接続して動作する。データのソースオブトゥルースは常に API 側にあり、この UI は申請・承認・記録の閲覧と操作を提供する。

## 開発

リポジトリルートから:

```bash
make dev   # api / web / cli をまとめて起動
```

web 単体で起動する場合:

```bash
bun run dev
```

## ディレクトリ

- `app/(app)/` … 認証後の画面。ドメインごとのルートに page.tsx とコンポーネントを collocation
- `app/(auth)/` … ログイン画面
- `components/` … 画面横断の共有コンポーネント
- `components/ui/` … shadcn 生成物（直接編集しない）
- `lib/api/` … API クライアント関数（1 関数 1 ファイル）
- `lib/<domain>/` … 権限判定などのドメインロジック

## 規約

コーディング規約は `.claude/rules/` を参照。変更後は `vp check` を通すこと。
