import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { systemFactory } from "@system/interface/http/system-factory"
import { POST } from "@system/interface/routes/system.v1.attachments.purge-unlinked"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"

const jwtSecret = "attachments-purge-route-test-secret"

const uploadedAt = new Date("2026-08-19T09:00:00.000Z")

/** アップロードから 24 時間以上あとの実行時刻。 */
const purgeAt = new Date("2026-08-21T09:00:00.000Z")

type Fixture = Readonly<{
  request: (path: string, init?: RequestInit) => Promise<Response>
  bucket: SystemAttachmentTestBucket
  tokenOf: (accountId: string) => Promise<string>
  storePending: () => Promise<void>
}>

async function createFixture(): Promise<Fixture> {
  const db = createSystemAttachmentTestDatabase()

  for (const accountId of ["account-admin", "account-member"]) {
    await db
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .bind(accountId, uploadedAt.getTime())
      .run()
  }

  await db
    .prepare(
      `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
       VALUES ('admin-role', 'system:root', 'managed', 'System root', ?1, ?1)`,
    )
    .bind(uploadedAt.getTime())
    .run()

  await db
    .prepare(
      `INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('admin-role', 'system:admin')`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES ('admin-binding', 'account-admin', 'admin-role', NULL, NULL, ?1, NULL)`,
    )
    .bind(uploadedAt.getTime())
    .run()

  const bucket = new SystemAttachmentTestBucket()

  const database = drizzle(db, { schema: { ...systemCoreSchema, ...systemAttachmentSchema } })

  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => purgeAt)
      context.set("database", database)
      await next()
    })
    .post("/system/v1/attachments/purge-unlinked", ...POST)

  const applications = createSystemSessionApplications({
    context: { env: { DB: db } },
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })

  if (applications instanceof Error) throw applications

  return {
    bucket,
    request: async (path, init) =>
      app.request(path, init, {
        DB: db,
        JWT_SECRET: jwtSecret,
        ATTACHMENTS: bucket as unknown as R2Bucket,
        ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
      }),
    tokenOf: async (accountId) => {
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
    storePending: async () => {
      const stored = await new StoreAttachment({
        var: { database },
        env: {
          ATTACHMENTS: bucket as unknown as R2Bucket,
          ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
        },
      }).run({
        ownerAccountId: "account-member",
        fileName: "領収書.pdf",
        contentType: "application/pdf",
        content: new TextEncoder().encode("%PDF-1.7 領収書"),
        now: uploadedAt,
      })

      if (stored instanceof Error) throw stored
    },
  }
}

describe("POST /system/v1/attachments/purge-unlinked", () => {
  test("system:admin は期限切れの未紐づけ添付を掃除できる", async () => {
    const fixture = await createFixture()

    await fixture.storePending()

    expect(fixture.bucket.size()).toBe(1)

    const token = await fixture.tokenOf("account-admin")

    const response = await fixture.request("/system/v1/attachments/purge-unlinked", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ purged_count: 1 })
    expect(fixture.bucket.size()).toBe(0)
  })

  test("権限のない主体は実行できず、本体も消えない", async () => {
    const fixture = await createFixture()

    await fixture.storePending()

    const token = await fixture.tokenOf("account-member")

    const response = await fixture.request("/system/v1/attachments/purge-unlinked", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(403)
    expect(fixture.bucket.size()).toBe(1)
  })

  test("未認証は実行できない", async () => {
    const fixture = await createFixture()

    await fixture.storePending()

    const response = await fixture.request("/system/v1/attachments/purge-unlinked", {
      method: "POST",
    })

    expect(response.status).toBe(401)
    expect(fixture.bucket.size()).toBe(1)
  })
})
