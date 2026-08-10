import { describe, expect, test } from "bun:test"
import { MigrateLegacyHashes } from "@/application/system/batch/migrate-legacy-hashes"
import { toLegacyPasswordHash } from "@/lib/auth/to-legacy-password-hash"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"

/** 認証情報(identities.secret)が移行対象。account と password identity を 1 組み立てる。 */
async function insertPasswordIdentity(
  db: D1Database,
  props: { id: number; secret: string },
): Promise<void> {
  await seedD1(db, "accounts", [
    {
      id: props.id,
      status: "active",
      token_version: 0,
      created_at: 0,
      updated_at: 0,
    },
  ])

  await seedD1(db, "identities", [
    {
      id: props.id,
      account_id: props.id,
      provider: "password",
      subject: `you+e${String(props.id).padStart(3, "0")}@example.com`,
      secret: props.secret,
      email: `you+e${String(props.id).padStart(3, "0")}@example.com`,
      email_verified: 1,
      created_at: 0,
    },
  ])
}

describe("MigrateLegacyHashes", () => {
  test("migrates legacy hash to pbkdf2-wrapped-legacy format", async () => {
    const { context, db } = createTestContext()

    const legacyHash = await toLegacyPasswordHash("password123")

    await insertPasswordIdentity(db, { id: 1, secret: legacyHash })

    const result = await new MigrateLegacyHashes(context).run()

    if (result instanceof Error) {
      throw new Error(`migration failed: ${result.message}`)
    }

    expect(result.total).toBe(1)
    expect(result.migrated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)

    const row = await db.prepare("SELECT secret FROM identities WHERE id = 1").first()

    if (row === null) {
      throw new Error("identity row not found")
    }

    expect(typeof row.secret).toBe("string")
    expect(String(row.secret).startsWith("pbkdf2-wrapped-legacy:")).toBe(true)
  })

  test("skips identities with pbkdf2 format secret", async () => {
    const { context, db } = createTestContext()

    const pbkdf2Hash = await toPasswordHash("password123")

    await insertPasswordIdentity(db, { id: 1, secret: pbkdf2Hash })

    const result = await new MigrateLegacyHashes(context).run()

    if (result instanceof Error) {
      throw new Error(`migration failed: ${result.message}`)
    }

    expect(result.total).toBe(0)
    expect(result.migrated).toBe(0)
    expect(result.skipped).toBe(0)
  })

  test("returns zero counts when no identities exist", async () => {
    const { context } = createTestContext()

    const result = await new MigrateLegacyHashes(context).run()

    if (result instanceof Error) {
      throw new Error(`migration failed: ${result.message}`)
    }

    expect(result.total).toBe(0)
    expect(result.migrated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)
  })

  test("handles mixed legacy and modern hashes", async () => {
    const { context, db } = createTestContext()

    const legacyHash = await toLegacyPasswordHash("password123")
    const pbkdf2Hash = await toPasswordHash("password456")

    await insertPasswordIdentity(db, { id: 1, secret: legacyHash })
    await insertPasswordIdentity(db, { id: 2, secret: pbkdf2Hash })

    const result = await new MigrateLegacyHashes(context).run()

    if (result instanceof Error) {
      throw new Error(`migration failed: ${result.message}`)
    }

    expect(result.total).toBe(1)
    expect(result.migrated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)
  })
})
