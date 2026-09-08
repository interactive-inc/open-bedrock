import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { GET } from "@system/interface/routes/system.attachments.$attachmentId"
import { POST } from "@system/interface/routes/system.attachments"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"

const now = new Date("2026-08-20T09:00:00.000Z")

const jwtSecret = "attachments-route-test-secret"

type Fixture = Readonly<{
  db: D1Database
  afterObjectRead: (effect: () => Promise<void>) => void
  advanceClock: (milliseconds: number) => void
  request: (path: string, init?: RequestInit) => Promise<Response>
  bucket: SystemAttachmentTestBucket
  tokenOf: (accountId: string) => Promise<string>
  auditActions: (targetId: string) => Promise<ReadonlyArray<string>>
}>

async function createFixture(
  machineKind: "agent" | "service" | "connector" | null = null,
): Promise<Fixture> {
  const db = createSystemAttachmentTestDatabase()
  const clock = { current: machineKind === null ? now : new Date() }

  for (const accountId of ["account-owner", "account-other"]) {
    await db
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .bind(accountId, clock.current.getTime())
      .run()
  }

  if (machineKind !== null) {
    if (machineKind === "connector") {
      await db
        .prepare(`INSERT INTO system_connectors
        (id, key, name, direction, transport, status, revision, created_at, updated_at)
        VALUES ('test-connector', 'test-connector', 'Test connector', 'bidirectional', 'api', 'active', 1, ?1, ?1)`)
        .bind(clock.current.getTime())
        .run()
    }
    await db
      .prepare(`INSERT INTO system_principals
      (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
      VALUES ('principal-owner', 'account-owner', ?1, 'Test machine', ?2, 1, ?3, ?3)`)
      .bind(
        machineKind,
        machineKind === "connector" ? "test-connector" : null,
        clock.current.getTime(),
      )
      .run()
    await db
      .prepare(`INSERT INTO system_machine_credentials
      (id, principal_id, name, secret_hash, status, created_at, updated_at, last_used_at)
      VALUES ('credential-owner', 'principal-owner', 'Test credential', ?1, 'active', ?2, ?2, ?2)`)
      .bind("a".repeat(64), clock.current.getTime())
      .run()
  }

  const bucket = new SystemAttachmentTestBucket()
  const readEffects: Array<() => Promise<void>> = []
  const getObject = bucket.get.bind(bucket)
  bucket.get = async (key) => {
    const object = await getObject(key)
    for (const effect of readEffects) await effect()
    return object
  }

  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => clock.current)
      context.set(
        "database",
        drizzle(db, { schema: { ...systemCoreSchema, ...systemAttachmentSchema } }),
      )
      await next()
    })
    .post("/attachments", ...POST)
    .get("/attachments/:attachmentId", ...GET)

  const applications = createSystemSessionApplications({
    context: { env: { DB: db } },
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })

  if (applications instanceof Error) throw applications

  return {
    db,
    afterObjectRead: (effect) => readEffects.push(effect),
    advanceClock: (milliseconds) => {
      clock.current = new Date(clock.current.getTime() + milliseconds)
    },
    bucket,
    auditActions: async (targetId) => {
      const rows = await db
        .prepare(
          `SELECT action FROM system_audit_events WHERE target_type = 'attachment' AND target_id = ?1`,
        )
        .bind(targetId)
        .all<{ action: string }>()

      return (rows.results ?? []).map((row) => row.action)
    },
    request: async (path, init) =>
      app.request(path, init, {
        DB: db,
        JWT_SECRET: jwtSecret,
        ATTACHMENTS: bucket as unknown as R2Bucket,
        ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
      }),
    tokenOf: async (accountId) => {
      if (machineKind !== null && accountId === "account-owner") {
        const token = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
          { accountId, tokenVersion: 0, machineCredentialId: "credential-owner" },
          jwtSecret,
          clock.current,
        )
        if (token instanceof Error) throw token
        return token
      }
      // access token の検証は実時計で行われるため、発行も実時刻にそろえる
      const issuance = await applications.issue.execute({
        accountId: zAccountId.parse(accountId),
        tokenVersion: 0,
        now: new Date(),
        auditContext: { authorizationJson: null, metadataJson: null },
      })

      if (issuance instanceof Error || issuance.kind === "rejected") {
        throw new Error("テスト用トークンを発行できません")
      }

      return issuance.accessToken
    },
  }
}

type CreatedAttachment = Readonly<{
  id: string
  status: string
  file_name: string
}>

async function createdBody(response: Response): Promise<CreatedAttachment> {
  const body = await response.json()

  if (typeof body !== "object" || body === null) throw new Error("応答が object ではありません")

  const record: Record<string, unknown> = { ...body }

  if (typeof record.id !== "string") throw new Error("id がありません")

  return {
    id: record.id,
    status: String(record.status),
    file_name: String(record.file_name),
  }
}

function receiptForm(fileName = "領収書.pdf", type = "application/pdf"): FormData {
  const form = new FormData()

  form.set("file", new File([new TextEncoder().encode("%PDF-1.7 領収書")], fileName, { type }))

  return form
}

describe("POST /attachments", () => {
  test("認証済みなら添付を預けられ、暗号文だけが保管される", async () => {
    const fixture = await createFixture()

    const token = await fixture.tokenOf("account-owner")

    const response = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })

    expect(response.status).toBe(201)

    const body = await createdBody(response)

    expect(body.status).toBe("pending")
    expect(body.file_name).toBe("領収書.pdf")
    expect(typeof body.id).toBe("string")

    const stored = fixture.bucket.storedBytes(`att/${body.id}`)

    if (stored === null) throw new Error("本体が無い")

    expect(new TextDecoder().decode(stored)).not.toContain("領収書")
  })

  test("未認証は拒否する", async () => {
    const fixture = await createFixture()

    const response = await fixture.request("/attachments", {
      method: "POST",
      body: receiptForm(),
    })

    expect(response.status).toBe(401)
    expect(fixture.bucket.size()).toBe(0)
  })

  test("許可していない形式を拒否する", async () => {
    const fixture = await createFixture()

    const token = await fixture.tokenOf("account-owner")

    const response = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm("script.exe", "application/octet-stream"),
    })

    expect(response.status).toBe(400)
    expect(fixture.bucket.size()).toBe(0)
  })

  test("file フィールドが無ければ拒否する", async () => {
    const fixture = await createFixture()

    const token = await fixture.tokenOf("account-owner")

    const response = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: new FormData(),
    })

    expect(response.status).toBe(400)
  })
})

describe("GET /attachments/:attachmentId", () => {
  const machineKinds: ReadonlyArray<"agent" | "service" | "connector"> = [
    "agent",
    "service",
    "connector",
  ]
  test.each([...machineKinds])("有効な%sも本人の添付を読める", async (kind) => {
    const fixture = await createFixture(kind)
    const token = await fixture.tokenOf("account-owner")
    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })
    expect(created.status).toBe(201)
    const body = await createdBody(created)
    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("領収書")
    const audit = await fixture.db
      .prepare(`SELECT authorization_json, metadata_json FROM system_audit_events
      WHERE action = 'attachment.read' AND target_id = ?1`)
      .bind(body.id)
      .first<{ authorization_json: string; metadata_json: string }>()
    expect(JSON.parse(audit?.authorization_json ?? "null")).toEqual({
      policy: "owner-unlinked",
      accountId: "account-owner",
      tokenVersion: 0,
      machineCredentialId: "credential-owner",
    })
    expect(JSON.parse(audit?.metadata_json ?? "null")).toEqual({
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      byteSize: new TextEncoder().encode("%PDF-1.7 領収書").byteLength,
    })
  })

  test.each(["revoked", "expired", "connector-disabled"])(
    "本体取得中の機械認証変更%sで開示を拒否する",
    async (change) => {
      const fixture = await createFixture(change === "connector-disabled" ? "connector" : "agent")
      const token = await fixture.tokenOf("account-owner")
      const created = await fixture.request("/attachments", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: receiptForm(),
      })
      expect(created.status).toBe(201)
      const body = await createdBody(created)
      if (change === "expired") {
        await fixture.db.exec(`UPDATE system_machine_credentials SET expires_at = created_at + 1000
        WHERE id = 'credential-owner'`)
      }
      fixture.afterObjectRead(async () => {
        if (change === "revoked") {
          await fixture.db
            .exec(`UPDATE system_machine_credentials SET status = 'revoked', revoked_at = updated_at
          WHERE id = 'credential-owner'`)
        }
        if (change === "expired") fixture.advanceClock(1000)
        if (change === "connector-disabled") {
          await fixture.db
            .exec(`UPDATE system_connectors SET status = 'disabled', revision = revision + 1
          WHERE id = 'test-connector'`)
        }
      })

      const response = await fixture.request(`/attachments/${body.id}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(response.status).toBe(401)
      expect(await response.text()).not.toContain("領収書")
      expect(await fixture.auditActions(body.id)).toEqual([])
    },
  )

  test.each(["ABORT", "IGNORE"])("閲覧監査のINSERTが%sなら平文を返さない", async (failure) => {
    const fixture = await createFixture()
    const token = await fixture.tokenOf("account-owner")
    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })
    const body = await createdBody(created)
    await fixture.db.exec(`CREATE TRIGGER reject_attachment_read_audit
      BEFORE INSERT ON system_audit_events WHEN NEW.action = 'attachment.read'
      BEGIN SELECT RAISE(${failure === "ABORT" ? "ABORT, 'test_audit_failure'" : "IGNORE"}); END;`)

    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("領収書")
    expect(await fixture.auditActions(body.id)).toEqual([])
  })

  test.each([
    ["業務へ紐付いた", "status = 'linked', linked_at = 1"],
    ["消去された", "status = 'erased', wrapped_dek = NULL, wrapped_dek_iv = NULL, erased_at = 1"],
    ["所有者が変わった", "owner_account_id = 'account-other'"],
    ["名前が変わった", "file_name = 'changed.pdf'"],
    ["内容digestが変わった", "plaintext_sha256 = 'changed'"],
    ["容量が変わった", "byte_size = byte_size + 1"],
    ["鍵が変わった", "wrapped_dek = 'changed'"],
  ])("本体取得中に%s添付は開示しない", async (_name, changes) => {
    const fixture = await createFixture()
    const token = await fixture.tokenOf("account-owner")
    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })
    const body = await createdBody(created)
    fixture.afterObjectRead(async () => {
      await fixture.db
        .prepare(`UPDATE system_attachments SET ${changes} WHERE id = ?1`)
        .bind(body.id)
        .run()
    })

    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain("領収書")
    expect(await fixture.auditActions(body.id)).toEqual([])
  })

  test.each([
    ["無効化", "status = 'suspended', token_version = token_version + 1"],
    ["トークン失効", "token_version = token_version + 1"],
  ])("本体取得中にAccountが%sされたら開示しない", async (_name, changes) => {
    const fixture = await createFixture()
    const token = await fixture.tokenOf("account-owner")
    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })
    const body = await createdBody(created)
    fixture.afterObjectRead(async () => {
      await fixture.db.exec(`UPDATE system_accounts SET ${changes} WHERE id = 'account-owner'`)
    })

    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain("領収書")
    expect(await fixture.auditActions(body.id)).toEqual([])
  })

  test("監査保存と最終検査の間で紐付いた場合は監査も巻き戻す", async () => {
    const fixture = await createFixture()
    const token = await fixture.tokenOf("account-owner")
    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })
    const body = await createdBody(created)
    await fixture.db.exec(`CREATE TRIGGER link_during_attachment_read_audit
      AFTER INSERT ON system_audit_events WHEN NEW.action = 'attachment.read'
      BEGIN UPDATE system_attachments SET status = 'linked', linked_at = NEW.occurred_at
        WHERE id = NEW.target_id; END;`)

    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain("領収書")
    expect(await fixture.auditActions(body.id)).toEqual([])
    expect(
      await fixture.db
        .prepare("SELECT status FROM system_attachments WHERE id = ?1")
        .bind(body.id)
        .first<string>("status"),
    ).toBe("pending")
  })

  test("監査保存中にトークンが失効した場合も全体を巻き戻す", async () => {
    const fixture = await createFixture()
    const token = await fixture.tokenOf("account-owner")
    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })
    const body = await createdBody(created)
    await fixture.db.exec(`CREATE TRIGGER revoke_during_attachment_read_audit
      AFTER INSERT ON system_audit_events WHEN NEW.action = 'attachment.read'
      BEGIN UPDATE system_accounts SET token_version = token_version + 1
        WHERE id = NEW.actor_account_id; END;`)

    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain("領収書")
    expect(await fixture.auditActions(body.id)).toEqual([])
    expect(
      await fixture.db
        .prepare("SELECT token_version FROM system_accounts WHERE id = 'account-owner'")
        .first<number>("token_version"),
    ).toBe(0)
  })

  test("保存された容量が本体と異なる場合は開示しない", async () => {
    const fixture = await createFixture()
    const token = await fixture.tokenOf("account-owner")
    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })
    const body = await createdBody(created)
    await fixture.db
      .prepare("UPDATE system_attachments SET byte_size = byte_size + 1 WHERE id = ?1")
      .bind(body.id)
      .run()

    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain("領収書")
    expect(await fixture.auditActions(body.id)).toEqual([])
  })

  test("預けた本人は紐づけ前の添付を取り出せる", async () => {
    const fixture = await createFixture()

    const token = await fixture.tokenOf("account-owner")

    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })

    const body = await createdBody(created)

    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.text()).toContain("領収書")
  })

  test("他人の添付は見えない", async () => {
    const fixture = await createFixture()

    const ownerToken = await fixture.tokenOf("account-owner")

    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${ownerToken}` },
      body: receiptForm(),
    })

    const body = await createdBody(created)

    const otherToken = await fixture.tokenOf("account-other")

    const response = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${otherToken}` },
    })

    expect(response.status).toBe(404)
  })

  test("取り出しを監査に記録する", async () => {
    const fixture = await createFixture()

    const token = await fixture.tokenOf("account-owner")

    const created = await fixture.request("/attachments", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: receiptForm(),
    })

    const body = await createdBody(created)

    expect(await fixture.auditActions(body.id)).toEqual([])

    const download = await fixture.request(`/attachments/${body.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(download.status).toBe(200)
    expect(await fixture.auditActions(body.id)).toEqual(["attachment.read"])
  })

  test("存在しない添付は 404", async () => {
    const fixture = await createFixture()

    const token = await fixture.tokenOf("account-owner")

    const response = await fixture.request("/attachments/00000000-0000-4000-8000-000000000000", {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(404)
  })
})
