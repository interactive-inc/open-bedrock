import { prepareAuditLogAppend } from "@/contexts/system/infrastructure/audit/audit-log-appender"
import { createSystemD1TestDatabase } from "@system/infrastructure/auth/system-d1-test-database.test-support"
import { describe, expect, test } from "bun:test"

const AUDIT_SCHEMA = `
  CREATE TABLE audit_logs (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    role text NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    metadata text,
    created_at integer NOT NULL
  )
`

describe("AuditLogAppender", () => {
  test("System の汎用 envelope を statement 化し、metadata の機密値を再帰的に伏せる", async () => {
    const database = createSystemD1TestDatabase(AUDIT_SCHEMA)

    await database.batch([
      prepareAuditLogAppend(database, {
        userId: "actor-1",
        role: "管理者",
        action: "update",
        resourceType: "accounts",
        resourceId: "account-1",
        metadata: {
          z: 1,
          a: 2,
          changedFields: ["name", "password"],
          nested: {
            apiKey: "api-key",
            currentPassword: "plain-text",
            jwtSecret: "jwt-secret",
            token: "secret-token",
            token_version: 7,
          },
        },
        createdAt: new Date(1_234),
      }),
    ])

    const row = await database
      .prepare(
        `SELECT user_id, role, action, resource_type, resource_id, metadata, created_at
         FROM audit_logs`,
      )
      .first<{
        user_id: string
        role: string
        action: string
        resource_type: string
        resource_id: string
        metadata: string
        created_at: number
      }>()

    expect(row).not.toBeNull()
    expect(row).toMatchObject({
      user_id: "actor-1",
      role: "管理者",
      action: "update",
      resource_type: "accounts",
      resource_id: "account-1",
      created_at: 1_234,
    })
    expect(row?.metadata).toBe(
      '{"a":2,"changedFields":["name","password"],"nested":{"apiKey":"[REDACTED]","currentPassword":"[REDACTED]","jwtSecret":"[REDACTED]","token":"[REDACTED]","token_version":7},"z":1}',
    )
  })

  test("不正な System event は D1 statement の生成前に拒否する", async () => {
    const database = createSystemD1TestDatabase(AUDIT_SCHEMA)

    expect(() =>
      prepareAuditLogAppend(database, {
        userId: "actor-1",
        role: "管理者",
        action: "not valid",
        resourceType: "accounts",
        resourceId: "account-1",
        metadata: null,
        createdAt: new Date(1_234),
      }),
    ).toThrow("audit action is invalid")

    expect(
      await database.prepare("SELECT COUNT(*) FROM audit_logs").first<number>("COUNT(*)"),
    ).toBe(0)
  })

  test("不正・過大な metadata は getter と D1 prepare を実行せず拒否する", () => {
    let getterCalls = 0
    let prepareCalls = 0
    const sourceDatabase = createSystemD1TestDatabase(AUDIT_SCHEMA)
    const database = new Proxy(sourceDatabase, {
      get(target, property, receiver) {
        if (property !== "prepare") return Reflect.get(target, property, receiver)

        return (...parameters: Parameters<D1Database["prepare"]>) => {
          prepareCalls += 1
          return target.prepare(...parameters)
        }
      },
    })
    const accessorMetadata = Object.defineProperty({}, "password", {
      enumerable: true,
      get() {
        getterCalls += 1
        return "must-not-be-read"
      },
    })

    expect(() =>
      prepareAuditLogAppend(database, {
        userId: "actor-1",
        role: "管理者",
        action: "update",
        resourceType: "accounts",
        resourceId: "account-1",
        metadata: accessorMetadata,
        createdAt: new Date(1_234),
      }),
    ).toThrow("system audit JSON contains an unsupported value")
    expect(() =>
      prepareAuditLogAppend(database, {
        userId: "actor-1",
        role: "管理者",
        action: "update",
        resourceType: "accounts",
        resourceId: "account-1",
        metadata: { value: "x".repeat(65_525) },
        createdAt: new Date(1_234),
      }),
    ).toThrow("system audit JSON exceeds the 64 KiB limit")
    expect(getterCalls).toBe(0)
    expect(prepareCalls).toBe(0)
  })
})
