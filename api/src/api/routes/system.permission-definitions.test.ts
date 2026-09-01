import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"

const jwtSecret = "permission-definitions-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(db, [{ id: 1, code: "E001", name: "Admin", status: "active" }])
  await seedIamForEmployees(db, [
    { id: 1, email: "you+e001@example.com", passwordHash: "hash", role: "root" },
  ])

  return db
}

async function listPermissionKeys(props: {
  enabledOptInApps?: string
  disabledDefaultApps?: string
}): Promise<ReadonlyArray<string>> {
  const db = await createTestDb()
  const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })

  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/system/permission-definitions",
    token,
    enabledOptInApps: props.enabledOptInApps,
    disabledDefaultApps: props.disabledDefaultApps,
  })

  expect(response.status).toBe(200)

  const body = (await response.json()) as {
    data: ReadonlyArray<{ key: string }>
    total: number
  }

  expect(body.total).toBe(body.data.length)

  return body.data.map((entry) => entry.key)
}

describe("GET /system/permission-definitions", () => {
  test("全機能が有効なら所有Appの権限を返す", async () => {
    const keys = await listPermissionKeys({ enabledOptInApps: "all" })

    expect(keys).toContain("expense:approve")
    expect(keys).toContain("goal:read:all")
    expect(keys).toContain("thanks_reward:manage")
  })

  test("opt-in Appを無効にするとその権限が応答から消える", async () => {
    const keys = await listPermissionKeys({ enabledOptInApps: "none" })

    expect(keys).not.toContain("goal:read:all")
    expect(keys).not.toContain("thanks_reward:manage")
    expect(keys).not.toContain("oneonone:create")
    expect(keys).toContain("expense:approve")
  })

  test("default Appを無効にするとその権限が応答から消える", async () => {
    const keys = await listPermissionKeys({
      enabledOptInApps: "all",
      disabledDefaultApps: "expenses",
    })

    expect(keys).not.toContain("expense:approve")
    expect(keys).toContain("goal:read:all")
  })

  test("同じcontextでも機能キーが違えば独立して無効になる", async () => {
    const keys = await listPermissionKeys({
      enabledOptInApps: "all",
      disabledDefaultApps: "budgets",
    })

    expect(keys).not.toContain("budget:manage")
    expect(keys).toContain("expense:approve")
  })

  test("機能ゲートの対象外の権限は無効化しても残る", async () => {
    const keys = await listPermissionKeys({
      enabledOptInApps: "none",
      disabledDefaultApps: "all",
    })

    expect(keys).toContain("system:admin")
    expect(keys).toContain("iam:write")
    expect(keys).toContain("employee:read")
    expect(keys).toContain("governance:manage")
  })
})
