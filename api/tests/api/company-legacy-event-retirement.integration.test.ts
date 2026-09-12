import { expect, test } from "bun:test"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"

test("旧人事注記は管理者も追加できず、記録日と適用日が異なる原記録をそのまま読める", async () => {
  const db = createD1TestDatabase(loadSchema())
  await initializeStandardCompanyTestState(db)
  await db
    .prepare(`INSERT INTO company_employee_events
    (employee_id, kind, effective_date, from_department_code, to_department_code, note, created_at)
    VALUES (?, 'retire', '2020-01-01', ' OLD ', NULL, '  Original note  ', '2021-02-03T04:05:06Z')`)
    .bind(toWorkforceEmployeeId(1))
    .run()
  const before = await db.prepare("SELECT * FROM company_employee_events ORDER BY id").all()
  const jwtSecret = "legacy-event-retirement-test-secret"
  const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
  const common = { db, jwtSecret, token }
  const write = await requestWithContext({
    ...common,
    method: "POST",
    path: "/company/employee-events",
    body: { employee_code: "E001", kind: "join", effective_date: "2026-01-01" },
  })
  expect(write.status).toBe(404)
  expect(await db.prepare("SELECT * FROM company_employee_events ORDER BY id").all()).toEqual(
    before,
  )
  const read = await requestWithContext({
    ...common,
    path: "/company/employee-events?employee_code=E001",
  })
  expect(read.status).toBe(200)
  expect(await read.json()).toMatchObject({
    data: [
      {
        kind: "retire",
        effective_date: "2020-01-01",
        created_at: "2021-02-03T04:05:06Z",
        note: "  Original note  ",
        from_department_code: " OLD ",
        to_department_code: null,
      },
    ],
    total: 1,
  })
})
