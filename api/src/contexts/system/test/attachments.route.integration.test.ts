import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { systemFactory } from "@system/interface/http/system-factory"
import { GET } from "@system/interface/routes/attachments.$attachmentId"
import { POST } from "@system/interface/routes/attachments"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"

const now = new Date("2026-08-20T09:00:00.000Z")

const jwtSecret = "attachments-route-test-secret"

type Fixture = Readonly<{
  request: (path: string, init?: RequestInit) => Promise<Response>
  bucket: SystemAttachmentTestBucket
  tokenOf: (accountId: string) => Promise<string>
  auditActions: (targetId: string) => Promise<ReadonlyArray<string>>
}>

async function createFixture(): Promise<Fixture> {
  const db = createSystemAttachmentTestDatabase()

  for (const accountId of ["account-owner", "account-other"]) {
    await db
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .bind(accountId, now.getTime())
      .run()
  }

  const bucket = new SystemAttachmentTestBucket()

  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => now)
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
