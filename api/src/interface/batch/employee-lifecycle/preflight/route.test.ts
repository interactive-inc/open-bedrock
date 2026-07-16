import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "lifecycle-migration-route-test-secret"

async function database(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await db.exec(`
    INSERT INTO departments (id, name) VALUES (1, 'Product');
    INSERT INTO org_departments
      (code, department_id, parent_code, manager_employee_code, sort_order)
    VALUES ('D001', 1, NULL, 'E001', 1);
    INSERT INTO employees (id, code, name, dept_id, dept_name, position, status) VALUES
      (1, 'E001', 'Fixture Admin', 1, 'Product', 'Manager', 'active'),
      (2, 'E002', 'Fixture Member', 1, 'Product', 'Member', 'active');
    INSERT INTO org_memberships
      (department_code, employee_code, manager_employee_code) VALUES
      ('D001', 'E001', NULL), ('D001', 'E002', 'E001');
  `)
  await seedIamForEmployees(db, [
    { id: 1, email: "you+admin@example.com", passwordHash: "fixture", role: "admin" },
    { id: 2, email: "you+member@example.com", passwordHash: "fixture", role: "member" },
  ])
  return db
}

const input = { baseline_on: "2026-01-01", time_zone: "Asia/Tokyo" }

describe("employee lifecycle migration routes", () => {
  test("registers preflight, backfill, verify, and rebuild for authorized admins", async () => {
    const db = await database()
    const token = await createTestToken(jwtSecret, { employeeId: 1 })
    const preflightResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/batch/employee-lifecycle/preflight",
      token,
      method: "POST",
      body: input,
    })
    expect(preflightResponse.status).toBe(200)
    const preflight = (await preflightResponse.json()) as { legacy_source_fingerprint: string }
    const command = {
      ...input,
      legacy_source_fingerprint: preflight.legacy_source_fingerprint,
    }

    for (const path of ["/batch/employee-lifecycle/backfill", "/batch/employee-lifecycle/verify"]) {
      const response = await requestWithContext({
        db,
        jwtSecret,
        path,
        token,
        method: "POST",
        body: command,
      })
      expect(response.status).toBe(200)
    }

    const rebuild = await requestWithContext({
      db,
      jwtSecret,
      path: "/batch/employee-lifecycle/rebuild-projections",
      token,
      method: "POST",
    })
    expect(rebuild.status).toBe(200)
  })

  test("returns 401 without authentication and 403 unless both permissions are live", async () => {
    const db = await database()
    const memberToken = await createTestToken(jwtSecret, { employeeId: 2 })
    const unauthorized = await requestWithContext({
      db,
      jwtSecret,
      path: "/batch/employee-lifecycle/preflight",
      token: null,
      method: "POST",
      body: input,
    })
    const forbidden = await requestWithContext({
      db,
      jwtSecret,
      path: "/batch/employee-lifecycle/preflight",
      token: memberToken,
      method: "POST",
      body: input,
    })

    expect(unauthorized.status).toBe(401)
    expect(forbidden.status).toBe(403)
  })
})
