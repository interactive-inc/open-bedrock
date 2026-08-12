# Contexts

バックエンドの機能は、最終的に次の構成で所有する。

```text
src/contexts/<context>/
  domain/
  application/
  infrastructure/
  interface/
```

- `system` は他のコンテキストへ依存しない。
- `company` は `system` だけを利用できる。
- 業務コンテキストは `system` と `company` だけを利用でき、業務同士では依存しない。
- 全コンテキストの合成と route 登録は `src/api` が担い、コンテキストから API root へ逆依存しない。
- `src/lib` はコンテキスト、API、DBに依存しない中立な共通処理だけを持つ。
- Interface は Hono、Infrastructure は Drizzle・D1などの実装技術を利用してよい。
- 型のためだけの `contracts` 層は作らず、型の所有レイヤーから `import type` する。

機能を削除するときは、対象コンテキストのディレクトリと API root の登録だけを削除する。他のコンテキストの変更を必要とする依存は追加しない。
