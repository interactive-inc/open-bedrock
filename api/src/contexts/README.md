# Contexts

バックエンドの機能は、最終的に次の構成で所有する。

```text
src/contexts/<context>/
  domain/
  application/
  infrastructure/
  interface/
  test/
```

- `system` は他のコンテキストへ依存しない。
- `company` は `system` だけを利用できる。
- 削除可能な各 App は独立した業務コンテキストにし、`system` と `company` だけを利用できる。業務同士では依存しない。
- 全コンテキストの合成と route 登録は `src/api` が担い、コンテキストから API root へ逆依存しない。
- `src/lib` はコンテキスト、API、DBに依存しない中立な共通処理だけを持つ。
- Interface は Hono、Infrastructure は Drizzle・D1などの実装技術を利用してよい。
- 型のためだけの `contracts` 層は作らず、型の所有レイヤーから `import type` する。
- 単一層のテストは実装の隣、複数層を横断するテストはcontext直下の単数形 `test/` に置く。複数形 `tests/` は作らない。

機能を削除するときは、対象コンテキストのディレクトリと API root の登録だけを削除する。他のコンテキストの変更を必要とする依存は追加しない。

## 所有境界

- `system` は認証、認可、案件、タスク、判断、承認、実行許可、監査、通知、非同期処理、外部連携の汎用機構を所有する。
- `company` は法人、従業員、雇用、組織、所属、責任、権限、System Accountとの対応を所有する。
- その他は削除可能な App であり、`contexts/` 直下へ `attendance`、`expense` のように機能名で置く。
- dashboard、inbox、directory、search は正本を持たず、`src/api` または利用側で複数コンテキストを合成する。

申請内容と業務上の実行規則は各 App が所有する。System は申請内容の変更不能な参照と digest、状態遷移、判断、承認、実行許可を所有し、Company は判断者の会社上の資格を解決する。System に Employee、Department、Company 固有のpermissionを追加しない。

## 互換コンテキスト

canonical へ移行するまでの旧実装を、正本のコンテキストから隔離するために置く。

- `system-compatibility` は旧 DB 互換の System 実装（旧通知、旧 batch、パスワード・CLI ログイン、旧 IAM 操作、旧 system schema）を持つ。`system` と同格の下位提供層であり、`system` だけを利用できる。`system` と `company` からは利用せず、`company-compatibility` と業務コンテキストからは利用できる。
- `company-compatibility` は旧 Company wire と旧 storage の移行 adapter を持つ。`api/src/contexts/company` の変更なしに削除できる状態を維持する。

どちらも新機能の配置先にしない。新しい import、新しい正本、新しい API を追加せず、依存を減らす方向だけへ変更する。#1085 の canonical 移行が完了した時点で、ディレクトリごと削除する。
