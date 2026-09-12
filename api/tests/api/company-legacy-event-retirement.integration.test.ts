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
    .prepare(`INSERT INTO company_personnel_annotations
    (employee_id, kind, effective_date, from_department_code, to_department_code, note, created_at)
    VALUES (?, 'retire', '2020-01-01', ' OLD ', NULL, '  Original note  ', '2021-02-03T04:05:06Z')`)
    .bind(toWorkforceEmployeeId(1))
    .run()
  const before = await db.prepare("SELECT * FROM company_personnel_annotations ORDER BY id").all()
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
  expect(await db.prepare("SELECT * FROM company_personnel_annotations ORDER BY id").all()).toEqual(
    before,
  )
  const read = await requestWithContext({
    ...common,
    path: "/company/personnel-annotations?employee_code=E001",
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

test("台帳にない対象の原記録も権限で参照でき、IDの精度と空文字を失わない", async () => {
  const db = createD1TestDatabase(loadSchema())
  await initializeStandardCompanyTestState(db)
  await db
    .prepare(`INSERT INTO company_personnel_annotations VALUES
    (9223372036854775807, 'orphan:source', 'unknown-kind', '', ' OLD ', NULL, '', 'unknown timestamp')`)
    .run()
  const jwtSecret = "annotation-read-test-secret"
  const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
  const common = { db, jwtSecret, token }
  const response = await requestWithContext({
    ...common,
    path: "/company/personnel-annotations?employee_id=orphan%3Asource&kind=unknown-kind",
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    data: [
      {
        id: "9223372036854775807",
        employee_id: "orphan:source",
        kind: "unknown-kind",
        effective_date: "",
        note: "",
        created_at: "unknown timestamp",
      },
    ],
    total: 1,
  })
  expect(
    (await requestWithContext({ ...common, path: "/company/employee-events?employee_code=E001" }))
      .status,
  ).toBe(404)
  expect(
    (
      await requestWithContext({
        ...common,
        path: "/company/personnel-annotations?employee_id=orphan%3Asource",
        token: null,
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await requestWithContext({
        ...common,
        path: "/company/personnel-annotations?employee_id=orphan%3Asource&employee_code=E001",
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await requestWithContext({
        ...common,
        method: "POST",
        path: "/company/personnel-annotations",
        body: {},
      })
    ).status,
  ).toBe(404)
})

test("他者の注記には閲覧権限が必要で、本人の対象IDだけは参照できる", async () => {
  const db = createD1TestDatabase(loadSchema())
  await initializeStandardCompanyTestState(db)
  await db
    .prepare("DELETE FROM system_iam_role_permissions WHERE permission_key = 'employee:read'")
    .run()
  const jwtSecret = "annotation-owner-test-secret"
  const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(2) })
  const common = { db, jwtSecret, token }
  expect(
    (
      await requestWithContext({
        ...common,
        path: "/company/personnel-annotations?employee_id=orphan",
      })
    ).status,
  ).toBe(403)
  expect(
    (await requestWithContext({ ...common, path: "/company/personnel-annotations?employee_id=2" }))
      .status,
  ).toBe(200)
})
