import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"

const jwtSecret = "organization-unit-route-test-secret"
const createKey = "32345678-1234-4abc-8def-1234567890ab"
const updateKey = "42345678-1234-4abc-8def-1234567890ab"
const deleteKey = "52345678-1234-4abc-8def-1234567890ab"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await initializeStandardCompanyTestState(db)
  return db
}

async function request(
  db: D1Database,
  method: "POST" | "PUT" | "DELETE",
  path: string,
  key: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path,
    token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) }),
    method,
    body,
    headers: { "Idempotency-Key": key },
  })
}

async function unitPeriodCount(db: D1Database, code: string): Promise<number> {
  return (
    (await db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM company_organization_unit_period_versions
          WHERE code = ?1`,
      )
      .bind(code)
      .first<number>("count")) ?? 0
  )
}

describe("Company organization unit idempotency", () => {
  test("replays create before duplicate-code validation and preserves the generated ID", async () => {
    const db = await createTestDb()
    const command = { code: "LEGAL", name: "Legal", parent_code: null }

    const created = await request(db, "POST", "/company/organization-units", createKey, command)
    const createdBody = (await created.json()) as { id: string }
    const replayed = await request(db, "POST", "/company/organization-units", createKey, command)
    const replayedBody = (await replayed.json()) as { id: string }

    expect(created.status).toBe(201)
    expect(replayed.status).toBe(200)
    expect(replayedBody.id).toBe(createdBody.id)
    expect(await unitPeriodCount(db, "LEGAL")).toBe(1)
  })

  test("rejects key reuse with another create payload", async () => {
    const db = await createTestDb()
    await request(db, "POST", "/company/organization-units", createKey, {
      code: "LEGAL",
      name: "Legal",
      parent_code: null,
    })

    const conflict = await request(db, "POST", "/company/organization-units", createKey, {
      code: "LEGAL",
      name: "Changed",
      parent_code: null,
    })

    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toMatchObject({ code: "idempotency_conflict" })
    expect(await unitPeriodCount(db, "LEGAL")).toBe(1)
  })

  test("replays update and delete without appending duplicate revisions", async () => {
    const db = await createTestDb()
    await request(db, "POST", "/company/organization-units", createKey, {
      code: "LEGAL",
      name: "Legal",
      parent_code: null,
    })

    const update = () =>
      request(db, "PUT", "/company/organization-units/LEGAL", updateKey, {
        name: "Legal and Compliance",
        parent_code: null,
      })
    expect((await update()).status).toBe(200)
    expect((await update()).status).toBe(200)
    expect(await unitPeriodCount(db, "LEGAL")).toBe(2)

    const remove = () => request(db, "DELETE", "/company/organization-units/LEGAL", deleteKey)
    expect((await remove()).status).toBe(204)
    expect((await remove()).status).toBe(204)
    expect(await unitPeriodCount(db, "LEGAL")).toBe(3)
  })
})
