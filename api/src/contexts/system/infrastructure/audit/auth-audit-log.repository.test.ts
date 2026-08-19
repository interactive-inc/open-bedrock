import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { describe, expect, test } from "bun:test"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { AuthAuditLogRepository } from "@/contexts/system/infrastructure/audit/auth-audit-log.repository"
import type * as schema from "@/contexts/system/infrastructure/schema/system-runtime"

type Db = DrizzleD1Database<typeof schema>

type CapturedInsert = {
  values: Record<string, unknown> | null
}

/**
 * insert(...).values(...) だけを捕捉する最小のフェイク db。repository は
 * insert().values() 以外の drizzle API を使わないため、この 2 メソッドで十分。
 */
function createCapturingDb(captured: CapturedInsert): Db {
  const fake = {
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        captured.values = row
      },
    }),
  }

  return fake as unknown as Db
}

/**
 * insert が必ず throw する db。best-effort であることの確認用。
 */
function createThrowingDb(): Db {
  const fake = {
    insert: () => ({
      values: async () => {
        throw new Error("d1 write failed")
      },
    }),
  }

  return fake as unknown as Db
}

describe("AuthAuditLogRepository", () => {
  test("resourceType は常に auth で固定される", async () => {
    const captured: CapturedInsert = { values: null }

    await new AuthAuditLogRepository({
      var: { database: createCapturingDb(captured), now: () => new Date(0) },
    }).write(
      WriteOperationEntity.create("record", {
        userId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        role: "operator",
        action: "login",
        resourceId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        metadata: null,
      }),
    )

    expect(captured.values?.resourceType).toBe("auth")
    expect(captured.values?.userId).toBe("8bd0f42f-fc67-489e-82b7-2d1226984f57")
    expect(captured.values?.role).toBe("operator")
    expect(captured.values?.action).toBe("login")
    expect(captured.values?.resourceId).toBe("8bd0f42f-fc67-489e-82b7-2d1226984f57")
  })

  test("id はプレフィックスなしの UUID で生成される", async () => {
    const captured: CapturedInsert = { values: null }

    await new AuthAuditLogRepository({
      var: { database: createCapturingDb(captured), now: () => new Date(0) },
    }).write(
      WriteOperationEntity.create("record", {
        userId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        role: "unknown",
        action: "logout",
        resourceId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        metadata: null,
      }),
    )

    expect(captured.values?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  test("metadata が null のときは metadata 列も null になる", async () => {
    const captured: CapturedInsert = { values: null }

    await new AuthAuditLogRepository({
      var: { database: createCapturingDb(captured), now: () => new Date(0) },
    }).write(
      WriteOperationEntity.create("record", {
        userId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        role: "unknown",
        action: "logout",
        resourceId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        metadata: null,
      }),
    )

    expect(captured.values?.metadata).toBe(null)
  })

  test("metadata の機微キーは JSON 直列化前に redact される", async () => {
    const captured: CapturedInsert = { values: null }

    await new AuthAuditLogRepository({
      var: { database: createCapturingDb(captured), now: () => new Date(0) },
    }).write(
      WriteOperationEntity.create("record", {
        userId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        role: "unknown",
        action: "register",
        resourceId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        metadata: { email: "a@example.com", password: "secret", token: "tok" },
      }),
    )

    const metadata = captured.values?.metadata

    expect(typeof metadata).toBe("string")

    const parsed = JSON.parse(metadata as string)

    expect(parsed.email).toBe("a@example.com")
    expect(parsed.password).toBe("[redacted]")
    expect(parsed.token).toBe("[redacted]")
  })

  test("平文パスワードは metadata に一切残らない", async () => {
    const captured: CapturedInsert = { values: null }

    await new AuthAuditLogRepository({
      var: { database: createCapturingDb(captured), now: () => new Date(0) },
    }).write(
      WriteOperationEntity.create("record", {
        userId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        role: "unknown",
        action: "change-password",
        resourceId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        metadata: { currentPassword: "old-secret", newPassword: "new-secret" },
      }),
    )

    const metadata = captured.values?.metadata as string

    expect(metadata.includes("old-secret")).toBe(false)
    expect(metadata.includes("new-secret")).toBe(false)
  })

  test("insert が失敗しても throw しない (best-effort)", async () => {
    const promise = new AuthAuditLogRepository({
      var: { database: createThrowingDb(), now: () => new Date(0) },
    }).write(
      WriteOperationEntity.create("record", {
        userId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        role: "unknown",
        action: "login",
        resourceId: "8bd0f42f-fc67-489e-82b7-2d1226984f57",
        metadata: null,
      }),
    )

    await expect(promise).resolves.toBeUndefined()
  })
})
