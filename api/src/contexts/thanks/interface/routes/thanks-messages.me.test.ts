import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const thanksResponseSchema = z.object({
  id: z.number(),
  sender_employee_id: zEmployeeId,
  sender_name: z.string(),
  recipient_employee_id: zEmployeeId,
  recipient_name: z.string(),
  message: z.string(),
  points: z.number(),
  created_at: z.string(),
})

const thanksListResponseSchema = z.object({
  data: z.array(thanksResponseSchema),
  total: z.number(),
})

const jwtSecret = "thanks-messages-me-test-secret"

/** seed: E004 Drew Sato（id 4）と E005 Emery Lane（id 5）の双方向の感謝を用意する。 */
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)
  await initializeStandardCompanyTestState(db)

  return db
}

function senderToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(4),
  })
}

function recipientToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(5),
  })
}

async function request(props: {
  db: D1Database
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: props.db,
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /thanks-messages/me", () => {
  test("returns only thanks sent by the current employee, newest first", async () => {
    const db = await createTestDb()

    // employee 4 → 5 を2件、employee 5 → 4 を1件送る。
    await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "1件目" },
    })

    await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "2件目" },
    })

    await request({
      db,
      path: "/thanks/thanks-messages",
      token: await recipientToken(),
      method: "POST",
      body: { recipient_employee_code: "E004", message: "お返し" },
    })

    const response = await request({
      db,
      path: "/thanks/thanks-messages/me",
      token: await senderToken(),
    })

    expect(response.status).toBe(200)

    const parsed = thanksListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.length).toBe(2)
      expect(
        parsed.data.data.every((row) => row.sender_employee_id === toWorkforceEmployeeId(4)),
      ).toBe(true)
      expect(parsed.data.data[0]?.message).toBe("2件目")
      expect(parsed.data.data[1]?.message).toBe("1件目")
    }
  })

  test("honors limit and offset", async () => {
    const db = await createTestDb()

    for (const message of ["1件目", "2件目", "3件目"]) {
      await request({
        db,
        path: "/thanks/thanks-messages",
        token: await senderToken(),
        method: "POST",
        body: { recipient_employee_code: "E005", message },
      })
    }

    const response = await request({
      db,
      path: "/thanks/thanks-messages/me?limit=1&offset=1",
      token: await senderToken(),
    })

    const parsed = thanksListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.total).toBe(3)
      expect(parsed.data.data[0]?.message).toBe("2件目")
    }
  })

  test("returns an empty list for an employee who never sent thanks", async () => {
    const db = await createTestDb()

    await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "感謝" },
    })

    const response = await request({
      db,
      path: "/thanks/thanks-messages/me",
      token: await recipientToken(),
    })

    const parsed = thanksListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
      expect(parsed.data.total).toBe(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const db = await createTestDb()

    const response = await request({ db, path: "/thanks/thanks-messages/me", token: null })

    expect(response.status).toBe(401)
  })
})
