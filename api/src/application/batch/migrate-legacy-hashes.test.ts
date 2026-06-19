import { describe, expect, test } from "bun:test"
import { MigrateLegacyHashes } from "@/application/batch/migrate-legacy-hashes"
import { toLegacyPasswordHash } from "@/lib/auth/legacy-password-hash"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"

async function insertEmployee(
  db: D1Database,
  props: { id: number; passwordHash: string },
): Promise<void> {
  await seedD1(db, "employees", [
    {
      id: props.id,
      code: `E${String(props.id).padStart(3, "0")}`,
      name: "Test Worker",
      email: `you+e${String(props.id).padStart(3, "0")}@example.com`,
      password_hash: props.passwordHash,
      role: "member",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
  ])
}

describe("MigrateLegacyHashes", () => {
  test("migrates legacy hash to pbkdf2-wrapped-legacy format", async () => {
    const { context, db } = createTestContext()

    const legacyHash = await toLegacyPasswordHash("password123")

    await insertEmployee(db, { id: 1, passwordHash: legacyHash })

    const result = await new MigrateLegacyHashes(context).run()

    if (result instanceof Error) {
      throw new Error(`migration failed: ${result.message}`)
    }

    expect(result.total).toBe(1)
    expect(result.migrated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)

    const row = await db.prepare("SELECT password_hash FROM employees WHERE id = 1").first()

    const updatedHash = (row as Record<string, unknown>)?.password_hash

    expect(typeof updatedHash).toBe("string")
    expect(String(updatedHash).startsWith("pbkdf2-wrapped-legacy:")).toBe(true)
  })

  test("skips employees with pbkdf2 format hash", async () => {
    const { context, db } = createTestContext()

    const pbkdf2Hash = await toPasswordHash("password123")

    await insertEmployee(db, { id: 1, passwordHash: pbkdf2Hash })

    const result = await new MigrateLegacyHashes(context).run()

    if (result instanceof Error) {
      throw new Error(`migration failed: ${result.message}`)
    }

    expect(result.total).toBe(0)
    expect(result.migrated).toBe(0)
    expect(result.skipped).toBe(0)
  })

  test("returns zero counts when no employees exist", async () => {
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

    await insertEmployee(db, { id: 1, passwordHash: legacyHash })
    await insertEmployee(db, { id: 2, passwordHash: pbkdf2Hash })

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
