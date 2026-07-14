# 追記専用監査基盤実装計画

> エージェント実行者向け: 必須サブスキルとして `superpowers:subagent-driven-development` を推奨し、代替として `superpowers:executing-plans` を使う。各チェック項目を一つずつ実行し、振る舞い単位でレビューする。

目的: 認証、IAM、従業員ライフサイクル、申請承認、委任、監査閲覧を改ざん不能な証跡として残し、API、Web、CLI から権限付きで検索、詳細確認、CSV 出力できるようにする。

構造: 要求コンテキストが相関情報だけを供給し、型付き監査イベント生成器が秘密値除去と安定化を担い、D1 repository が業務更新と監査 INSERT を一つの batch へまとめる。監査 API は同じフィルター契約を一覧と出力で共有し、Web と CLI は API の認可結果を迂回せず表示または保存だけを担当する。

技術スタック: TypeScript、Bun、Hono、Cloudflare Workers、D1、Drizzle ORM、Zod、Next.js、React、Tailwind CSS、shadcn/ui、Vitest 互換の Vite Plus テスト。

## 全体制約

- 正本の設計は `.docs/plans/2026-07-14-audit-ledger-design.md` とする。
- ユーザーの明示指示により `main` で作業し、各完成単位を直接コミットする。
- 既存 migration は変更しない。監査構造は公開済みの `api/migrations/0015_audit_events.sql` と、適用済み環境へ追記専用 guard を届ける forward-only の `api/migrations/0016_audit_append_guard.sql` で追加する。
- Web と CLI は `api/app` から実行時値を import せず、`AppType` と `ApiClient` だけを type-only import する。
- `X-Open-Karte-Client` は `web`、`cli`、`api`、`system` の記録にだけ使い、認証、認可、職務分離の根拠にしない。
- 新規監査イベントは型付き生成器だけで作り、production code から任意の action、target type、JSON を直接 INSERT しない。
- 成功した重要変更と監査 INSERT は同じ D1 batch で確定し、監査失敗時は `503 audit_unavailable` とする。
- 監査イベントの更新と削除は DB trigger で拒否し、repository に更新、削除メソッドを作らない。
- パスワード、token、secret、Authorization、Cookie、秘密鍵、生メールアドレスを監査イベントへ保存しない。
- API の時刻入力は UTC に解決できる ISO 8601、応答時刻も ISO 8601 とする。DB は Unix 秒を保持する。
- 一覧カーソルは opaque とし、Web と CLI は内容を解釈しない。
- 旧監査行の自由語彙と null を保持するため、API 応答の action は string、target type は string または null とする。新規生成入力だけを閉じた語彙で制限する。
- 監査 GET と CSV 応答は `Cache-Control: no-store` とし、Web の API 呼び出しも `cache: "no-store"` とする。
- Web の監査リンクはすべて `prefetch={false}` とし、未クリックの検索、詳細閲覧を監査記録へ作らない。
- CLI の監査 CSV は既存ファイルを上書きせず、新規ファイルを mode `0600` で作る。`--out -` と存在しない親ディレクトリは拒否する。
- 公開リポジトリへ固有名詞、個人情報、実秘密、実トークンを含めない。
- 各 production 変更は失敗するテストを先に追加し、失敗理由を確認してから最小実装を行う。

---

## ファイル構成

API の新規ファイル:

- `api/migrations/0015_audit_events.sql`: 旧行を保持する新構造への移行、索引、追記専用 trigger、権限 seed。
- `api/migrations/0016_audit_append_guard.sql`: 適用済み環境を含め、過去 ID と event ID の置換を防ぐ追記専用 guard。
- `api/src/domain/audit/audit-event.ts`: action、target type、outcome、reason code、入力と投影の型。
- `api/src/lib/audit/stable-json.ts`: 再帰的秘密値除去、キー順安定化、六十四 KiB 制限。
- `api/src/lib/audit/hash-identifier.ts`: Web Crypto による HMAC-SHA-256。
- `api/src/lib/audit/audit-cursor.ts`: 双方向 opaque cursor の符号化と検証。
- `api/src/lib/audit/audit-csv.ts`: RFC 4180 と数式注入対策を行う CSV 生成。
- `api/src/interface/shared/request-context-middleware.ts`: 内部 request ID、client name、Cloudflare IP の収集。
- `api/src/infrastructure/audit/audit-event-repository.ts`: INSERT、検索、詳細、件数制限、監査付き読み取り。
- `api/src/interface/audit/audit-events/route.ts`: 一覧 API。
- `api/src/interface/audit/audit-events/[event_id]/route.ts`: 詳細 API。
- `api/src/interface/audit/audit-event-exports/route.ts`: CSV 出力 API。

Web の新規ファイル:

- `web/lib/api/get-audit-events.ts`: 一覧クライアント。
- `web/lib/api/get-audit-event.ts`: 詳細クライアント。
- `web/lib/api/export-audit-events.ts`: CSV 出力クライアント。
- `web/lib/api/types/audit-types.ts`: API 応答から導出する表示型。
- `web/app/(app)/admin/audit-events/page.tsx`: 権限ゲート付き一覧ページ。
- `web/app/(app)/admin/audit-events/[eventId]/page.tsx`: 権限ゲート付き詳細ページ。
- `web/app/(app)/admin/audit-events/export/route.ts`: httpOnly session を使って CSV を転送する Route Handler。
- `web/app/(app)/admin/audit-events/_components/audit-event-filter-form.tsx`: フィルター。
- `web/app/(app)/admin/audit-events/_components/audit-event-table.tsx`: 一覧と双方向 cursor。
- `web/app/(app)/admin/audit-events/_components/audit-json-view.tsx`: JSON の安全な整形表示。
- `web/app/(app)/admin/audit-events/_components/audit-export-form.tsx`: 最大三十一日の出力フォーム。
- `web/app/(app)/admin/audit-events/_lib/audit-event-labels.ts`: 既知コードの日本語表示と未知コードの生値 fallback。

CLI の新規ファイル:

- `cli/app/audit/route.ts`: グループ help。
- `cli/app/audit/list/route.ts`: 一覧コマンド。
- `cli/app/audit/show/route.ts`: 詳細コマンド。
- `cli/app/audit/export/route.ts`: 出力コマンド。
- `cli/lib/io/write-secure-file.ts`: 排他的 mode `0600` 出力。
- `cli/test/app/audit/audit.test.ts`: 引数、API 契約、エラー、保存の統合テスト。

既存変更の中心:

- `api/src/env.ts`、`api/src/app.ts`、`api/src/schema.ts`、`api/src/lib/app-schemas.ts`
- `api/src/lib/auth/permission-keys.ts`、`api/src/lib/auth/system-roles.ts`
- `api/src/application/auth`、`api/src/application/iam`、`api/src/application/employee`
- `api/src/application/application`、`api/src/infrastructure/application`
- `web/lib/api/hc-client.ts`、`web/components/sidebar-nav.tsx`
- `cli/lib/http/hc-client.ts`、`cli/app/index.ts`、`cli/lib/help-text.ts`
- `.docs/capability-map.md`、`.docs/authorization-model.md`、`.docs/api-schema.md`

## 永続化と要求コンテキスト

ファイル:

- 作成: `api/migrations/0015_audit_events.sql`
- 作成: `api/migrations/0016_audit_append_guard.sql`
- 作成: `api/src/interface/shared/request-context-middleware.ts`
- 作成: `api/src/interface/shared/request-context-middleware.test.ts`
- 変更: `api/src/schema.ts`
- 変更: `api/src/env.ts`
- 変更: `api/src/app.ts`
- 変更: `api/src/interface/shared/test/request-with-context.ts`
- 変更: `api/src/interface/shared/test/create-test-context.ts`
- 変更: `api/src/lib/auth/permission-keys.ts`
- 変更: `api/src/lib/auth/system-roles.ts`
- 変更: `api/.dev.vars.example`
- 変更: `api/wrangler.jsonc`

インターフェース:

- 生成: `RequestAuditContext = { requestId: string; clientName: "web" | "cli" | "api" | "system"; clientIp: string | null; externalRequestId: string | null }`
- 生成: `Variables.auditContext: RequestAuditContext`
- 生成: `Bindings.AUDIT_HMAC_SECRET: string`
- 生成: permission `audit:read` と `audit:export`
- 消費: Hono のすべての後続 route が `c.var.auditContext` を利用する。

- [ ] 旧構造を作って `0015_audit_events.sql` と `0016_audit_append_guard.sql` を順に適用する移行テストを `api/src/infrastructure/audit/audit-migration.test.ts` に追加する。`0015` 適用後に追加された行、legacy の負 ID、`0016` 二重適用も検証する。

```ts
expect(await db.prepare("SELECT count(1) AS count FROM audit_logs").first("count")).toBe(1)
expect(await db.prepare("SELECT event_id FROM audit_logs").first("event_id")).toBe("legacy-41")
await expect(db.prepare("DELETE FROM audit_logs WHERE id = 41").run()).rejects.toThrow()
await expect(db.prepare("UPDATE audit_logs SET action = 'x' WHERE id = 41").run()).rejects.toThrow()
```

- [ ] テストを実行し、新 migration と列が無いため失敗することを確認する。

実行: `cd api && bun test src/infrastructure/audit/audit-migration.test.ts`

期待: `no such column: event_id` または migration ファイル不在で失敗する。

- [ ] migration に新テーブルへの copy、rename、索引、`BEFORE UPDATE` と `BEFORE DELETE` trigger を実装する。

```sql
CREATE TABLE audit_logs_next (
  id INTEGER PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  actor_account_id INTEGER,
  actor_employee_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL CHECK (client_name IN ('web', 'cli', 'api', 'system')),
  created_at INTEGER NOT NULL
);
```

旧行は `legacy-` と文字列化した ID、`succeeded`、`api` を使って copy する。旧 metadata は `json_valid` ならそのまま、そうでなければ `json_object('legacy_text', metadata)` で内容を失わず有効な JSON に包む。permissions へ二権限を `INSERT OR IGNORE` し、admin role だけへ role_permissions を追加する。

- [ ] `schema.ts` の `auditLogs` を migration と同じ列、索引、文字列 target ID へ同期する。

- [ ] request middleware の失敗テストを追加する。

```ts
expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/)
expect(body.request_id).not.toBe("caller-controlled")
expect(body.client_name).toBe("api")
```

- [ ] middleware を実装する。

```ts
export const requestContextMiddleware = factory.createMiddleware(async (c, next) => {
  const clientHeader = c.req.header("X-Open-Karte-Client")
  const clientName = clientHeader === "web" || clientHeader === "cli" ? clientHeader : "api"
  const external = toExternalRequestId(c.req.header("X-Request-ID"))
  const requestId = crypto.randomUUID()

  c.set("auditContext", {
    requestId,
    clientName,
    clientIp: c.req.header("CF-Connecting-IP") ?? null,
    externalRequestId: external,
  })

  await next()
  c.header("X-Request-ID", requestId)
})
```

- [ ] `app.ts` の最初の全 route middleware として request context を登録し、body limit や rate limit が返す応答にも内部 request ID を付ける。CORS の `exposeHeaders` へ `X-Request-ID` を追加し、test helper へ既定 `AUDIT_HMAC_SECRET` と任意 request headers を追加する。

- [ ] `permission-keys.ts` と `system-roles.ts` を変更し、admin だけが二権限を持つテストを追加する。

- [ ] 対象テストを再実行する。

実行: `cd api && bun test src/infrastructure/audit/audit-migration.test.ts src/interface/shared/request-context-middleware.test.ts src/lib/auth/system-roles.test.ts`

期待: 全件 PASS。

- [ ] 変更をコミットする。

```bash
git add api/migrations/0015_audit_events.sql api/migrations/0016_audit_append_guard.sql api/src/schema.ts api/src/env.ts api/src/app.ts api/src/interface/shared api/src/lib/auth api/.dev.vars.example api/wrangler.jsonc
git commit -m "feat(api): add append-only audit storage"
```

## 監査イベント生成器

ファイル:

- 作成: `api/src/domain/audit/audit-event.ts`
- 作成: `api/src/domain/audit/audit-event.test.ts`
- 作成: `api/src/lib/audit/stable-json.ts`
- 作成: `api/src/lib/audit/stable-json.test.ts`
- 作成: `api/src/lib/audit/hash-identifier.ts`
- 作成: `api/src/lib/audit/hash-identifier.test.ts`
- 変更: `api/src/lib/errors.ts`
- 変更: `api/src/interface/lib/to-http-exception.ts`

インターフェース:

- 生成: `AuditAction`、`AuditTargetType`、`AuditOutcome` の閉じた union。
- 生成: `createAuditEvent(input: AuditEventInput, context: RequestAuditContext): AuditEventRecord`。
- 生成: `toStableAuditJson(value: AuditJsonValue): string | null`。
- 生成: `hashAuditIdentifier(identifier: string, secret: string): Promise<string>`。
- 生成: `UnavailableError("audit_unavailable", message)` を HTTP 503 へ変換する。

- [ ] action、target type、outcome の Zod schema と型の失敗テストを先に書く。

```ts
expect(() => auditActionSchema.parse("free.form.action")).toThrow()
expect(createAuditEvent(validInput, context).eventId).toMatch(/^[0-9a-f-]{36}$/)
expect(createAuditEvent(validInput, context).requestId).toBe(context.requestId)
```

- [ ] 再帰 redaction、安定キー順、配列、六十四 KiB 上限のテストを書く。

```ts
expect(toStableAuditJson({ z: 1, nested: { token: "raw", a: 2 } })).toBe(
  '{"nested":{"a":2,"token":"[REDACTED]"},"z":1}',
)
expect(() => toStableAuditJson({ value: "x".repeat(65_536) })).toThrow("audit_payload_too_large")
```

- [ ] HMAC の決定性、正規化、秘密差分、生識別子非包含をテストする。

```ts
const first = await hashAuditIdentifier(" User@Example.COM ", "secret-a")
const second = await hashAuditIdentifier("user@example.com", "secret-a")
expect(first).toBe(second)
expect(first).not.toContain("example.com")
expect(await hashAuditIdentifier("user@example.com", "secret-b")).not.toBe(first)
```

- [ ] テストを実行し、新しい module が無いため失敗することを確認する。

実行: `cd api && bun test src/domain/audit src/lib/audit`

期待: import 解決失敗。

- [ ] union と生成器を実装する。action は設計書の二十三語、target type は九語だけを受け付ける。

```ts
export type AuditEventInput = {
  actorAccountId: number | null
  actorEmployeeId: number | null
  action: AuditAction
  target: { type: AuditTargetType; id: string | null }
  outcome: AuditOutcome
  reasonCode: string | null
  authorization?: AuditJsonValue
  before?: AuditJsonValue
  after?: AuditJsonValue
  metadata?: AuditJsonValue
  now: Date
}
```

- [ ] `stable-json.ts` で plain object と配列だけを受け、秘密キーを大文字小文字と `_`、`-` の差を正規化して redaction する。非有限数、関数、symbol、循環参照を拒否する。

- [ ] Web Crypto の `crypto.subtle.importKey` と `sign("HMAC", ...)` で小文字 trim 済み識別子を SHA-256 HMAC 化する。

- [ ] `UnavailableError` と 503 変換を追加し、既存 HTTP error test を更新する。

- [ ] 対象テストを再実行する。

実行: `cd api && bun test src/domain/audit src/lib/audit src/interface/lib/to-http-exception.test.ts`

期待: 全件 PASS。

- [ ] 変更をコミットする。

```bash
git add api/src/domain/audit api/src/lib/audit api/src/lib/errors.ts api/src/interface/lib/to-http-exception.ts api/src/interface/lib/to-http-exception.test.ts
git commit -m "feat(api): create typed audit events"
```

## 監査 repository と検索契約

ファイル:

- 作成: `api/src/infrastructure/audit/audit-event-repository.ts`
- 作成: `api/src/infrastructure/audit/audit-event-repository.test.ts`
- 作成: `api/src/lib/audit/audit-cursor.ts`
- 作成: `api/src/lib/audit/audit-cursor.test.ts`
- 作成: `api/src/lib/audit/audit-csv.ts`
- 作成: `api/src/lib/audit/audit-csv.test.ts`

インターフェース:

- 生成: `AuditEventRepository.prepareAppend(record): readonly [D1PreparedStatement, D1PreparedStatement]`。通常の `INSERT` と直前変更件数 guard を不可分の batch fragment として返し、裸の INSERT は公開しない。
- 生成: `AuditEventRepository.append(record): Promise<void>`。
- 生成: `AuditEventRepository.search(query): Promise<AuditEventPage>`。
- 生成: `AuditEventRepository.findByEventId(eventId): Promise<AuditEventDetail | null>`。
- 生成: `AuditEventRepository.export(query): Promise<ReadonlyArray<AuditEventDetail>>`。
- 生成: `encodeAuditCursor` と `decodeAuditCursor`。
- 生成: `toAuditCsv(rows): string`。

- [ ] repository の insert、型変換、半開区間、同秒 ID 順、actor/action/target/outcome filter のテストを書く。

```ts
const page = await repository.search({ limit: 2, cursor: null, filters: {} })
expect(page.items.map((item) => item.eventId)).toEqual(["event-3", "event-2"])
expect(page.nextCursor).not.toBeNull()
expect(page.previousCursor).toBeNull()
```

- [ ] cursor 改ざん、方向、境界、未知 version のテストを書く。

```ts
const cursor = encodeAuditCursor({ version: 1, direction: "next", createdAt: 100, id: 20 })
expect(decodeAuditCursor(cursor)).toEqual({ version: 1, direction: "next", createdAt: 100, id: 20 })
expect(() => decodeAuditCursor("not-base64url")).toThrow("invalid_audit_cursor")
```

- [ ] CSV のカンマ、引用符、CRLF、改行、先頭 `=`, `+`, `-`, `@` のテストを書く。

```ts
expect(toAuditCsv([{ action: "=CMD()", metadataJson: '{"x":"a,b"}' }])).toContain("'=CMD()")
expect(toAuditCsv(rows)).toContain("\r\n")
```

- [ ] テストを実行して import 解決失敗を確認する。

実行: `cd api && bun test src/infrastructure/audit src/lib/audit/audit-cursor.test.ts src/lib/audit/audit-csv.test.ts`

- [ ] repository を実装する。next は `(created_at < ? OR created_at = ? AND id < ?)` を降順取得し、previous は逆条件を昇順取得して結果を反転する。`limit + 1` 件の狭い `(id, created_at, wire_bytes)` descriptor を先に取得し、指定 `limit` または保守的な四 MiB 累積要約 wire budget の早い方までを exact-ID 要約取得する。byte budget で短縮したページも前後 cursor を返し、単一要約行の超過は `audit_unavailable` とする。一覧 SQL は内部 ID と要約列だけを投影し、JSON 四列と client IP を取得しない。

- [ ] 詳細と CSV 出力は非 null の JSON 四列を構文検証し、scalar と旧 JSON-string wrapper は再直列化せず受理する。壊れた JSON は `audit_unavailable` とし、一覧要約では詳細列を検証しない。

- [ ] cursor は version、direction、createdAt、id の JSON を base64url 化し、Zod で検証する。秘密情報を含めないため署名は付けず、不正値は `ValidationError` で拒否する。

- [ ] CSV は固定列順、RFC 4180、CRLF、UTF-8 BOM なしとし、文字列化後の先頭危険文字へ単一引用符を付ける。

- [ ] 出力は狭い raw/wire byte descriptor と exact-ID 詳細取得の二段階にする。通常の exact-ID 取得は escaping と列名・JSON envelope を含む累積 wire byte を四 MiB 以内へ抑える。単一行が通常上限を超えても raw byte が完成 CSV の残量以内なら、allowlist 済みの各 text 列を二百五十六 KiB の BLOB segment で取得し、全 byte の再構築後に先頭 BOM を原文の一部として保持する fatal UTF-8 decode を行う。D1 の各応答は十六 MiB 未満とし、取得件数は五万一件目までに止め、五万件または完成 CSV 十六 MiB の超過を `audit_export_too_large` とする。

- [ ] 対象テストを再実行する。

実行: `cd api && bun test src/infrastructure/audit src/lib/audit`

期待: 全件 PASS。

- [ ] 変更をコミットする。

```bash
git add api/src/infrastructure/audit api/src/lib/audit
git commit -m "feat(api): add audit search and export repository"
```

## 監査 API

ファイル:

- 作成: `api/src/interface/audit/audit-events/route.ts`
- 作成: `api/src/interface/audit/audit-events/route.test.ts`
- 作成: `api/src/interface/audit/audit-events/[event_id]/route.ts`
- 作成: `api/src/interface/audit/audit-events/[event_id]/route.test.ts`
- 作成: `api/src/interface/audit/audit-event-exports/route.ts`
- 作成: `api/src/interface/audit/audit-event-exports/route.test.ts`
- 変更: `api/src/lib/app-schemas.ts`
- 変更: `api/src/app.ts`

インターフェース:

- 生成: `GET /audit-events` は `{ data, next_cursor, previous_cursor }` を返す。
- 生成: `GET /audit-events/:event_id` は構文検証済み JSON 列を保存時の文字列のまま返し、scalar と legacy wrapper も内容を失わない。
- 生成: `POST /audit-event-exports` は `text/csv; charset=utf-8` を返す。
- 一覧要約の `created_at` と詳細の時刻は ISO 8601。
- actor 表示の正本は `actor_account_id` と `actor_employee_id` で、現在の氏名を join しない。

- [ ] admin、read-only 動的 role、一般利用者で一覧、詳細、出力の権限差をテストする。

```ts
expect(
  (await requestWithContext({ path: "/audit-events", token: memberToken, db, jwtSecret })).status,
).toBe(403)
expect(
  (await requestWithContext({ path: "/audit-events", token: readerToken, db, jwtSecret })).status,
).toBe(200)
expect(
  (
    await requestWithContext({
      path: "/audit-event-exports",
      method: "POST",
      token: readerToken,
      body: range,
      db,
      jwtSecret,
    })
  ).status,
).toBe(403)
```

- [ ] filter、双方向 cursor、半開時刻、limit 一から百、未知 action、壊れた cursor、詳細不存在をテストする。

- [ ] 出力の必須範囲、終了が開始より後、最大三十一日、五万件上限、CSV header と Content-Disposition をテストする。

- [ ] 一覧、詳細、出力が応答前に自身の監査イベントを追加し、監査 INSERT 失敗時に本文を返さず 503 となるテストを書く。

- [ ] テストを実行し route 未登録で 404 になることを確認する。

実行: `cd api && bun test src/interface/audit`

期待: 404 または import 解決失敗。

- [ ] `app-schemas.ts` へ公開 schema を追加する。

```ts
export const auditEventSummarySchema = z.object({
  event_id: z.string(),
  request_id: z.string(),
  actor_account_id: z.number().nullable(),
  actor_employee_id: z.number().nullable(),
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  outcome: auditOutcomeSchema,
  reason_code: z.string().nullable(),
  client_name: auditClientNameSchema,
  created_at: z.string().datetime(),
})
```

- [ ] route は `verifyBearer` と `hasPermission` を使い、一覧と詳細に `audit:read`、出力に `audit:export` を要求する。

- [ ] 監査付き読み取りでは結果取得後に `audit.event.searched`、`audit.event.read`、`audit.event.exported` を append し、失敗時に `UnavailableError` を投げる。metadata は filter の stable SHA-256、requested limit、result count、format だけを持つ。

- [ ] `app.ts` へ三 route を RPC chain を壊さず登録する。

- [ ] 対象テストと API 型生成を実行する。

実行: `cd api && bun test src/interface/audit && bun run build:types && tsc --noEmit`

期待: 全件 PASS、型生成成功。

- [ ] 変更をコミットする。

```bash
git add api/src/interface/audit api/src/lib/app-schemas.ts api/src/app.ts api/dist/app.d.ts
git commit -m "feat(api): expose authorized audit events"
```

## 認証監査

ファイル:

- 変更: `api/src/application/auth/authenticate-employee.ts`
- 変更: `api/src/application/auth/refresh-access-token.ts`
- 変更: `api/src/infrastructure/auth/account-auth-repository.ts`
- 変更: `api/src/infrastructure/auth/refresh-token-repository.ts`
- 変更: `api/src/interface/auth/login/route.ts`
- 変更: `api/src/interface/auth/refresh/route.ts`
- 変更: `api/src/application/auth/authenticate-employee.test.ts`
- 変更: `api/src/application/auth/refresh-access-token.test.ts`
- 変更: `api/src/interface/auth/login/route.test.ts`

インターフェース:

- 消費: `createAuditEvent`、`hashAuditIdentifier`、`AuditEventRepository.prepareAppend`。
- 生成: login success、login denied、refresh、reuse detected の四操作を記録する。
- 既存 login/refresh 成功 body と既存認証失敗メッセージは変更しない。

- [ ] 正しい login が actor IDs と account target を記録し、生メール、password、token を DB 行へ含めないテストを追加する。

- [ ] 不正 login が actor null、`identifier_hash`、`invalid_credentials` を記録し、監査失敗時にもアカウント存在を区別しない 503 を返すテストを追加する。

- [ ] refresh 成功と token family 再利用が別 action、account target、family ID の hash だけを残すテストを追加する。

- [ ] テストを実行し、監査行が零件で失敗することを確認する。

実行: `cd api && bun test src/application/auth src/interface/auth/login/route.test.ts`

- [ ] authenticate の成功結果へ監査に必要な accountId と employeeId を内部的に返し、HTTP view では従来の token だけを選択する。

- [ ] login route で不正資格情報の identifier hash を作り、成功 token 発行と監査 INSERT は repository batch で確定する。失敗監査は資格情報応答を構築する前に append する。

- [ ] refresh repository の token rotation、family revoke、監査 INSERT を同じ batch にする。reuse 検知の family revoke と監査も同じ batch にする。

- [ ] 対象テストを再実行する。

実行: `cd api && bun test src/application/auth src/interface/auth`

期待: 全件 PASS。

- [ ] 変更をコミットする。

```bash
git add api/src/application/auth api/src/infrastructure/auth api/src/interface/auth
git commit -m "feat(api): audit authentication lifecycle"
```

## IAM と従業員ライフサイクル監査

ファイル:

- 変更: `api/src/application/iam/create-role.ts`
- 変更: `api/src/application/iam/update-role.ts`
- 変更: `api/src/application/iam/delete-role.ts`
- 変更: `api/src/application/iam/grant-account-role.ts`
- 変更: `api/src/application/iam/revoke-account-role.ts`
- 変更: `api/src/application/iam/set-account-status.ts`
- 変更: `api/src/application/iam/reset-account-password.ts`
- 変更: `api/src/infrastructure/iam/role-repository.ts`
- 変更: `api/src/infrastructure/iam/account-repository.ts`
- 変更: `api/src/application/employee/register-employee.ts`
- 変更: `api/src/application/employee/update-employee.ts`
- 変更: `api/src/application/employee/delete-employee.ts`
- 変更: `api/src/infrastructure/iam/account-provisioner.ts`
- 変更: `api/src/infrastructure/employee/employee-repository.ts`
- テスト: 対応する既存 IAM、employee test 群。

インターフェース:

- 消費: typed event と `prepareAppend` の二文 batch fragment。
- 生成: IAM、account、employee の設計書 action を成功、拒否、失敗の結果付きで記録する。
- 保証: live permission guard、権限部分集合、last effective admin guard と監査 INSERT は一つの原子的 batch 内で再検査する。

- [ ] 各 action の成功イベント、before/after の許可列、権限根拠を検証する table-driven test を追加する。

```ts
expect(event.authorization_json).toContain("iam:manage_roles")
expect(event.before_json).not.toContain("secret")
expect(event.after_json).toContain("application:approve")
```

- [ ] 自己昇格、権限不足、最後の実効管理者喪失、revision conflict を denied または failed として記録するテストを追加する。

- [ ] audit INSERT を故意に trigger failure させ、role/account/employee の変更が rollback され 503 となるテストを追加する。

- [ ] テストを実行し、監査行不足で失敗することを確認する。

実行: `cd api && bun test src/application/iam src/infrastructure/iam src/application/employee src/infrastructure/employee`

- [ ] repository の既存 batch builder に監査 statement を引数として追加する。use case は actor、権限、before/after を型付きで組み立て、repository は並行再検査と INSERT を同じ batch へ置く。

- [ ] password reset は変更事実と target account ID だけを記録し、password hash、temporary password を before/after/metadata に渡さない。

- [ ] employee は氏名、メール、住所を複製せず、changed field names、status、role keys、department identifier だけを投影する。

- [ ] delete は関連する承認、勤怠、評価、支出、申請を物理削除しない。従業員を `retired`、アカウントを `suspended` にし、refresh token を失効させ、identity の秘密を除去する原子的な tombstone 処理へ置き換える。保持期限後の匿名化は後続の保持能力で実行し、履歴参照を壊さない。

- [ ] 対象テストを再実行する。

実行: `cd api && bun test src/application/iam src/infrastructure/iam src/application/employee src/infrastructure/employee`

期待: 全件 PASS。

- [ ] 変更をコミットする。

```bash
git add api/src/application/iam api/src/infrastructure/iam api/src/application/employee api/src/infrastructure/employee
git commit -m "feat(api): audit privileged identity changes"
```

## ワークフロー監査

ファイル:

- 変更: `api/src/application/application/decide-workflow-application.ts`
- 変更: `api/src/application/application/reassign-workflow-step.ts`
- 変更: `api/src/infrastructure/application/application-workflow-repository.ts`
- 変更: `api/src/interface/application/templates/[code]/workflow/route.ts`
- 変更: `api/src/interface/application/approval-delegations/route.ts`
- 変更: `api/src/interface/application/approval-delegations/[id]/route.ts`
- 変更: 既存 workflow、decision、delegation test 群。

インターフェース:

- 消費: typed event と atomic insert statement。
- 生成: workflow updated/repaired、delegation created/cancelled、decision approved/rejected。
- 保証: candidate snapshot、step、round、quorum、delegated employee、delegation ID、actor account を authorization JSON へ保存する。

- [ ] workflow definition update、stale revision、repair、approve、reject、delegated approve、delegation cancel のイベントを検証するテストを追加する。

- [ ] 自己承認、無効候補者、期限外または取消済み委任、古い round、重複票の拒否イベントを検証する。

- [ ] audit INSERT failure で approval record と application transition がともに rollback されるテストを追加する。

- [ ] テストを実行し監査不足を確認する。

実行: `cd api && bun test src/application/application src/interface/application`

- [ ] workflow repository の revision batch、decision batch、repair batch、delegation conditional INSERT/取消 UPDATE に監査 statement を追加する。

- [ ] authorization JSON は `permission_keys`、`application_id`、`step_index`、`round`、`candidate_snapshot_id`、`delegated_employee_id`、`delegation_id`、`required_approvals` を必要な操作だけに保存する。

- [ ] denied/failed は業務 rollback 後に append し、その append 失敗は 503 へ変換する。

- [ ] 対象テストを再実行する。

実行: `cd api && bun test src/application/application src/interface/application`

期待: 全件 PASS。

- [ ] 変更をコミットする。

```bash
git add api/src/application/application api/src/infrastructure/application api/src/interface/application
git commit -m "feat(api): audit workflow decisions"
```

## Web 監査画面

ファイル:

- 作成: `web/lib/api/get-audit-events.ts`
- 作成: `web/lib/api/get-audit-event.ts`
- 作成: `web/lib/api/export-audit-events.ts`
- 作成: `web/lib/api/types/audit-types.ts`
- 作成: `web/app/(app)/admin/audit-events/page.tsx`
- 作成: `web/app/(app)/admin/audit-events/[eventId]/page.tsx`
- 作成: `web/app/(app)/admin/audit-events/export/route.ts`
- 作成: `web/app/(app)/admin/audit-events/_components/audit-event-filter-form.tsx`
- 作成: `web/app/(app)/admin/audit-events/_components/audit-event-table.tsx`
- 作成: `web/app/(app)/admin/audit-events/_components/audit-json-view.tsx`
- 作成: `web/app/(app)/admin/audit-events/_components/audit-export-form.tsx`
- 作成: `web/app/(app)/admin/audit-events/_lib/audit-event-labels.ts`
- 作成: 対応する `web` test files。
- 変更: `web/lib/api/hc-client.ts`
- 変更: `web/components/sidebar-nav.tsx`
- 変更: `web/components/command-palette.tsx`
- 変更: `web/components/back-button.tsx`
- 変更: `web/DESIGN.md`

インターフェース:

- 消費: API の opaque next/previous cursor、ISO 時刻、stable actor IDs、権限二種。
- 生成: `/admin/audit-events` と `/admin/audit-events/[eventId]`。
- 保証: `audit:read` の direct URL gate、`audit:export` の条件表示、全監査 Link の prefetch 無効化。

- [ ] `hc-client` が `X-Open-Karte-Client: web` を送るテストを追加する。

- [ ] sidebar が `audit:read` の保持時だけ監査リンクを表示し、その Link に `prefetch={false}` が渡るテストを追加する。

- [ ] 一覧の filter query、未知ラベル fallback、account/employee ID 表示、cursor URL 保持、詳細 Link の prefetch 無効化をテストする。

- [ ] 詳細 JSON の折り畳み、null 表示、秘密値表示切替が存在しないことをテストする。

- [ ] export permission の有無、三十一日超過 client validation、API error、成功 CSV stream、`Cache-Control: no-store` をテストする。

- [ ] テストを実行し module 不在を確認する。

実行: `cd web && bun run test -- admin/audit-events sidebar-nav hc-client`

- [ ] API client は Hono client の `$get` と `$post` を使い、監査 GET へ `{ init: { cache: "no-store" } }` を渡し、失敗時は既存 Error 契約へ変換する。`hc-client.ts` の共通 headers へ client header を追加する。

- [ ] page は `requirePermission("audit:read")` を先頭で実行し、URL query を Zod で安全に parse する。export form は current user の `audit:export` だけで表示する。

- [ ] `audit-event-labels.ts` は既知値を日本語へ変換し、未知 action、target、reason code は生文字列を返す。

- [ ] actor は `account:<id> / employee:<id>`、両方 null は `未認証` と表示し、氏名を別 API から補完しない。

- [ ] `NavItem`、`SubItem`、`BackButton` に任意 `prefetch?: boolean` を追加し、監査 sidebar、一覧詳細、前後 cursor、詳細戻る Link で false を指定する。command palette にも `audit:read` 導線を追加するが、明示選択時の `router.push` だけを使う。

- [ ] CSV は Server Action や Flight payload を通さない。Route Handler が upstream の body、Content-Type、Content-Disposition、X-Request-ID、403、413、503 を保持して転送し、常に `Cache-Control: no-store` を付ける。

- [ ] 対象テスト、型検査を実行する。

実行: `cd web && bun run test && bun run check`

期待: 全件 PASS。

- [ ] 変更をコミットする。

```bash
git add web/lib/api web/app/'(app)'/admin/audit-events web/components/sidebar-nav.tsx web/components/command-palette.tsx web/components/back-button.tsx web/DESIGN.md
git commit -m "feat(web): add audit event console"
```

## CLI 監査コマンド

ファイル:

- 作成: `cli/app/audit/route.ts`
- 作成: `cli/app/audit/list/route.ts`
- 作成: `cli/app/audit/show/route.ts`
- 作成: `cli/app/audit/export/route.ts`
- 作成: `cli/lib/io/write-secure-file.ts`
- 作成: `cli/test/app/audit/audit.test.ts`
- 作成: `cli/test/lib/hc-client-header.test.ts`
- 作成: `cli/test/lib/write-secure-file.test.ts`
- 変更: `cli/lib/http/hc-client.ts`
- 変更: `cli/app/index.ts`
- 変更: `cli/lib/help-text.ts`
- 変更: `cli/test/app/route-registration.test.ts`

インターフェース:

- 消費: API の list/show/export と opaque cursor。
- 生成: `audit list`、`audit show --event-id`、`audit export --from --to --out`。
- 生成: `writeSecureFile(path: string, contents: string): Promise<void>`。

- [ ] group help、三 route 登録、必須引数、全 filter、path param、403/413/503 の code と message 保持をテストする。

- [ ] CSV は API 成功後だけ書き、本文を CLI response へ返さず、失敗時に既存または新規ファイルを変更しないことをテストする。

- [ ] `writeSecureFile` が mode `0600`、既存拒否、`-` 拒否、親 directory 不在拒否、write error 時 cleanup を行うテストを書く。

- [ ] normal request、refresh request、retry request がすべて `X-Open-Karte-Client: cli` を送るテストを書く。

- [ ] テストを実行し route 不在を確認する。

実行: `cd cli && bun test test/app/audit test/lib/hc-client-header.test.ts test/lib/write-secure-file.test.ts`

- [ ] route を既存 `factory.createHandlers`、Zod、`createClient` の規約で実装し、`cli/app/index.ts` に四 route を POST 登録する。

- [ ] secure writer は `node:fs/promises.open(path, "wx", 0o600)`、`handle.writeFile`、`handle.sync`、`handle.close` を順に行い、失敗時は閉じて `unlink` する。既存ファイルは触らない。

- [ ] `hc-client.ts` の通常 headers と refresh の直接 fetch の両方へ client header を追加し、Bearer token を唯一の認証根拠として維持する。

- [ ] help と route registration test を更新する。

- [ ] CLI 全テストと型検査を実行する。

実行: `cd cli && bun test && bun run check`

期待: 全件 PASS。

- [ ] 変更をコミットする。

```bash
git add cli/app/audit cli/lib/io cli/lib/http/hc-client.ts cli/app/index.ts cli/lib/help-text.ts cli/test
git commit -m "feat(cli): add audit event commands"
```

## 文書同期と総合検証

ファイル:

- 変更: `.docs/capability-map.md`
- 変更: `.docs/authorization-model.md`
- 変更: `.docs/api-schema.md`
- 変更: `.docs/features.md`
- 変更: `.docs/sitemap.md`
- 変更: `README.md`

インターフェース:

- 消費: 完成した API、Web、CLI と自動テストの実証。
- 生成: 「IAM 監査ログ」を実装済みとする根拠、公開 route、権限、UI、CLI、残存差分。

- [ ] `cd api && bun run build:types` を実行し、`api/dist/app.d.ts` を最新 route と一致させる。

- [ ] API、Web、CLI の型検査と全テストを実行する。

```bash
cd api && bun test && bun run check
cd ../web && bun run test && bun run check
cd ../cli && bun test && bun run check
cd .. && vp check
```

期待: すべて exit code 0。既存生成 shadcn file の警告以外に新規警告なし。

- [ ] 監査語彙と秘密値を静的確認する。

```bash
rg -n 'password|authorization|cookie|token|secret|private_key|client_secret' api/src/domain/audit api/src/lib/audit
rg -n 'audit_logs.+(UPDATE|DELETE)|UPDATE audit_logs|DELETE FROM audit_logs' api/src --type ts | rg -v '\.test\.ts:'
```

期待: 第一コマンドは redaction catalog とテストだけ、第二コマンドは零件。

- [ ] `bun install`、ローカル migration、seed、`.dev.vars` の二秘密を用意し、`make dev` で portless を起動する。

- [ ] ブラウザで admin として login し、監査メニュー、フィルター、次頁、前頁、詳細、JSON 展開、CSV 出力を操作する。各明示操作だけが新監査イベントを一件作り、hover や未クリック Link では増えないことを DB で確認する。

- [ ] 一般利用者で login し、監査メニューが無いこと、`/admin/audit-events` と既知 event detail の直 URL が not found になること、API 直接要求が 403 になることを確認する。

- [ ] 動的 role に `audit:read` だけを付けた利用者で list/detail は成功し export は非表示かつ API 403、`audit:export` 追加後は出力成功となることを確認する。

- [ ] 監査 DB の UPDATE と DELETE をローカル D1 へ直接試し、trigger が拒否することを確認する。

- [ ] `.docs` を実装事実と同期し、80能力の数を変えず「IAM 監査ログ」だけを台帳のみから実装済みへ変更する。認可モデルの監査と従業員物理削除の差分を解消済みへし、緊急権限は残差として維持する。

- [ ] `vp fmt`、`git diff --check`、placeholder scan、公開情報衛生を確認する。

```bash
vp fmt
git diff --check
rg -n 'T[B]D|T[O]DO|F[I]XME|未[定]|要検[討]' .docs/plans/2026-07-14-audit-ledger-implementation.md
git diff --cached | rg -n 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|Bearer [A-Za-z0-9._-]{16,}|@[A-Za-z0-9.-]+\.(com|co\.jp)'
```

期待: placeholder と秘密情報の検出なし。

- [ ] 最終変更をコミットし `origin/main` へ push する。

```bash
git add api web cli .docs README.md
git commit -m "docs: document append-only audit operations"
git push origin main
```

## 完了判定

次を一つでも証明できない場合、この完成単位は完了としない。

- 初期適用範囲の全重要操作が成功、意図した拒否、競合または障害の証跡を残す。
- 成功した重要変更と監査イベントが同じ原子的境界で確定する。
- 監査 INSERT 障害で業務変更、監査閲覧、CSV 出力が成功として返らない。
- DB が監査イベントの UPDATE と DELETE を拒否する。
- API、Web、CLI で同じ filter 契約の検索、詳細、最大三十一日の CSV 出力が完結する。
- `audit:read` と `audit:export` が別々に強制される。
- 生 password、token、secret、認証 header、Cookie、生 login 識別子が DB、API、Web、CLI に現れない。
- Web の自動 prefetch が監査イベントを作らない。
- CLI が CSV を既存 file に上書きせず mode `0600` で作る。
- 全自動検査と admin、read-only、一般利用者のブラウザ検証が成功する。
- 機能網羅表、認可モデル、API、Web、CLI の記述と実装が一致する。
