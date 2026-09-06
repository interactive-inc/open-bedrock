import { z } from "zod"
import { employeeProfileVersionSchema } from "@/contexts/company/domain/definitions/employee-profile-version.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"

const jwtSecret = "employee-registration-route-test-secret"
const idempotencyKey = "12345678-1234-4abc-8def-1234567890ab"
const body = {
  code: "E100",
  name: "New Employee",
  email: "new-employee@example.com",
  password: "correct horse battery staple",
  role: "member" as const,
  hire_on: "2026-01-01",
  employment_type: "FULL_TIME",
  department_code: null,
  position_code: null,
  manager_employee_code: null,
}

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await initializeStandardCompanyTestState(db)
  return db
}

async function post(
  db: D1Database,
  requestBody: unknown,
  key: string | null = idempotencyKey,
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/company/employee-registrations",
    token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) }),
    method: "POST",
    body: requestBody,
    headers: key === null ? {} : { "Idempotency-Key": key },
  })
}

async function count(db: D1Database, table: string, where: string): Promise<number> {
  return (
    (await db
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`)
      .first<number>("count")) ?? 0
  )
}

describe("POST /company/employee-registrations", () => {
  test("明示した短時間勤務の契約を台帳と公開雇用へ保存する", async () => {
    const db = await createTestDb()
    const created = await post(db, { ...body, employment_type: "PART_TIME" })
    expect(created.status).toBe(201)
    expect((await post(db, { ...body, employment_type: "PART_TIME" })).status).toBe(200)
    expect((await post(db, { ...body, employment_type: "FULL_TIME" })).status).toBe(409)
    const contract = await db
      .prepare(`SELECT employment.id, employment.employment_type
      FROM company_employments AS employment JOIN company_employees AS employee
      ON employee.id = employment.employee_id WHERE employee.employee_code = 'E100'`)
      .first()
    expect(contract).toMatchObject({ employment_type: "PART_TIME" })
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/company/employments?effective_on=2026-01-01",
      token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) }),
      headers: { "x-company-organization-id": "organization:default" },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      resources: expect.arrayContaining([
        expect.objectContaining({
          attributes: expect.objectContaining({ employmentType: "PART_TIME" }),
        }),
      ]),
    })
  })

  test("creates the Company employee and System identity once, then replays the same command", async () => {
    const db = await createTestDb()

    const created = await post(db, body)
    const replayed = await post(db, body)

    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ code: "E100", replayed: false })
    expect(replayed.status).toBe(200)
    expect(await replayed.json()).toMatchObject({ code: "E100", replayed: true })
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(1)
    expect(await count(db, "system_identity_profiles", "email = 'new-employee@example.com'")).toBe(
      1,
    )
    expect(await count(db, "company_personnel_actions", `operation_id = '${idempotencyKey}'`)).toBe(
      1,
    )
    const employeeId = await db
      .prepare("SELECT id FROM company_employees WHERE employee_code = 'E100'")
      .first<string>("id")
    if (employeeId === null) throw new Error("missing registered employee")
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/company/employees?id=${employeeId}&effective_on=2026-01-01`,
      token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) }),
      headers: { "x-company-organization-id": "organization:default" },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      resources: [
        {
          id: employeeId,
          type: "employee",
          attributes: { employeeCode: "E100", personId: `person:${employeeId}` },
        },
      ],
    })
    expect(await count(db, "company_resource_revisions", `resource_id = '${employeeId}'`)).toBe(1)
  })

  test("雇用区分が欠落・不正ならAccountも従業員も作らない", async () => {
    const db = await createTestDb()
    const before = await count(db, "system_accounts", "1 = 1")
    for (const employment_type of [undefined, null, "UNKNOWN"]) {
      expect((await post(db, { ...body, employment_type })).status).toBe(400)
    }
    expect(await count(db, "system_accounts", "1 = 1")).toBe(before)
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(0)
  })

  test("公開正本の失敗時はAccountと従業員を残さず、同じkeyで再試行できる", async () => {
    const db = await createTestDb()
    const accountsBefore = await count(db, "system_accounts", "1 = 1")
    await db.exec(
      "CREATE TRIGGER reject_registered_resource BEFORE INSERT ON company_resource_revisions BEGIN SELECT RAISE(ABORT, 'resource unavailable'); END;",
    )
    expect((await post(db, body)).status).toBe(500)
    expect(await count(db, "system_accounts", "1 = 1")).toBe(accountsBefore)
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(0)
    expect(await count(db, "company_personnel_actions", `operation_id = '${idempotencyKey}'`)).toBe(
      0,
    )
    await db.exec("DROP TRIGGER reject_registered_resource")
    expect((await post(db, body)).status).toBe(201)
  })

  test("rejects reuse of the key with a different registration", async () => {
    const db = await createTestDb()
    expect((await post(db, body)).status).toBe(201)

    const response = await post(db, { ...body, email: "other@example.com" })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "idempotency_conflict" })
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(1)
  })

  test("Companyの版競合は409を返し、登録を確定しない", async () => {
    const db = await createTestDb()
    await db.exec(
      "CREATE TRIGGER conflict_registered_resource BEFORE INSERT ON company_command_receipts BEGIN SELECT RAISE(ABORT, 'company_revision_conflict'); END;",
    )
    const response = await post(db, body)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "employee_registration_conflict" })
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(0)
  })

  test("requires a UUID idempotency key before persistence", async () => {
    const db = await createTestDb()

    expect((await post(db, body, null)).status).toBe(400)
    expect((await post(db, body, "not-a-uuid")).status).toBe(400)
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(0)
  })
  test("登録した本人の表示版から氏名と電話を更新し、実認証・権限・競合を通して正本へ反映する", async () => {
    const db = await createTestDb()
    expect((await post(db, body)).status).toBe(201)
    const linked = await db
      .prepare(`SELECT employee.id, link.account_id
      FROM company_employees AS employee JOIN company_account_employee_links AS link ON link.employee_id = employee.id
      WHERE employee.employee_code = 'E100'`)
      .first<{ id: string; account_id: string }>()
    if (linked === null) throw new Error("registered account is missing")
    const token = await createTestToken(jwtSecret, {
      employeeId: restoreWorkforceId("employee", linked.id),
      accountId: linked.account_id,
    })
    const admin = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
    const read = () =>
      requestWithContext({ db, jwtSecret, path: "/company/current-profile", token })
    const current = z.object({
      name: z.string(),
      phone: z.string().nullable(),
      profile: employeeProfileVersionSchema,
    })
    const before = current.parse(await (await read()).json())
    const update = (path: string, actorToken: string, payload: unknown, key: string) =>
      requestWithContext({
        db,
        jwtSecret,
        path,
        token: actorToken,
        method: "PUT",
        body: payload,
        headers: { "idempotency-key": key },
      })
    expect(
      (
        await update(
          "/company/employee-directory/E100",
          admin,
          { name: "Changed Employee", profile: before.profile, reason: "Confirmed name change" },
          "name-change",
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await update(
          "/company/my-profile",
          token,
          { phone: "020-2000-2000", profile: before.profile, reason: "Confirmed phone change" },
          "stale-phone",
        )
      ).status,
    ).toBe(409)
    const afterName = current.parse(await (await read()).json())
    expect(afterName.name).toBe("Changed Employee")
    expect(
      (
        await update(
          "/company/my-profile",
          token,
          { phone: "020-2000-2000", profile: afterName.profile, reason: "Confirmed phone change" },
          "phone-change",
        )
      ).status,
    ).toBe(200)
    const afterPhone = current.parse(await (await read()).json())
    expect(afterPhone).toMatchObject({ name: "Changed Employee", phone: "020-2000-2000" })
    expect(afterPhone.profile.organizationRevision).toBe(afterName.profile.organizationRevision + 1)
    expect(
      (
        await update(
          "/company/employee-directory/E100",
          token,
          {
            name: "Unauthorized name",
            profile: afterPhone.profile,
            reason: "Attempted name change",
          },
          "forbidden-name",
        )
      ).status,
    ).toBe(403)
    expect(
      (await requestWithContext({ db, jwtSecret, path: "/company/my-profile", token: null }))
        .status,
    ).toBe(401)
  })
})
