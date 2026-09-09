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
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

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

const notificationResponseSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  source: z.object({ type: z.string(), id: z.string() }).nullable(),
})

const jwtSecret = "thanks-crud-test-secret"

/** seed: E004 Drew Sato（id 4）が送り手、E005 Emery Lane（id 5）が受け手 */
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
  now?: string
}): Promise<Response> {
  return requestWithContext({
    db: props.db,
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
    now: props.now,
  })
}

describe("POST /thanks-messages", () => {
  test("全体と本人の一覧は将来の改名を発効日に表示し、感謝と人物履歴を変更しない", async () => {
    const db = await createTestDb()
    const repository = new D1CompanyResourceRepository(db)
    const initial = CompanyResourceChangeEntity.create({
      commandId: "thanks-name-initial",
      expectedRevision: 0,
      actorAccountId: "4",
      reason: "Confirmed person",
      recordedAt: 0,
      resources: [
        {
          organizationId: "organization:default",
          type: "person",
          id: "person:thanks-name",
          revision: 1,
          state: "active",
          effectiveFrom: restoreCalendarDate("2026-01-01"),
          effectiveTo: null,
          attributes: { officialName: "Current Person" },
        },
        {
          organizationId: "organization:default",
          type: "employee",
          id: "employee:thanks-name",
          revision: 1,
          state: "active",
          effectiveFrom: restoreCalendarDate("2026-01-01"),
          effectiveTo: null,
          attributes: { personId: "person:thanks-name" },
        },
        {
          organizationId: "organization:default",
          type: "employment",
          id: "employment:thanks-name",
          revision: 1,
          state: "active",
          effectiveFrom: restoreCalendarDate("2026-01-01"),
          effectiveTo: null,
          attributes: {
            employeeId: "employee:thanks-name",
            status: "ACTIVE",
            employmentType: "FULL_TIME",
          },
        },
      ],
    })
    if (initial instanceof Error) throw initial
    expect(await repository.write(initial)).toMatchObject({ kind: "applied" })
    const future = CompanyResourceChangeEntity.create({
      commandId: "thanks-name-future",
      expectedRevision: 1,
      actorAccountId: "4",
      reason: "Confirmed future name",
      recordedAt: 1,
      resources: [
        {
          organizationId: "organization:default",
          type: "person",
          id: "person:thanks-name",
          revision: 2,
          state: "active",
          effectiveFrom: restoreCalendarDate("2026-07-01"),
          effectiveTo: null,
          attributes: { officialName: "Future Person" },
        },
      ],
    })
    if (future instanceof Error) throw future
    expect(await repository.write(future)).toMatchObject({ kind: "applied" })
    await db
      .prepare(
        "INSERT INTO thanks_messages (sender_employee_id, recipient_employee_id, message, points, created_at) VALUES ('4', 'employee:thanks-name', 'Thank you', 0, '2026-06-01T00:00:00Z')",
      )
      .run()
    const before = await db
      .prepare("SELECT * FROM company_resource_revisions ORDER BY 1, 2, 3, 4")
      .all()
    const token = await senderToken()
    for (const now of ["2026-06-30T14:59:59Z", "2026-06-30T15:00:00Z"]) {
      for (const path of ["/thanks/thanks-messages", "/thanks/thanks-messages/me"]) {
        const response = await request({ db, token, path, now })
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
          data: [
            { recipient_name: now.endsWith("14:59:59Z") ? "Current Person" : "Future Person" },
          ],
          total: 1,
        })
      }
    }
    expect(
      (await db.prepare("SELECT * FROM company_resource_revisions ORDER BY 1, 2, 3, 4").all())
        .results,
    ).toEqual(before.results)
    expect(
      await db.prepare("SELECT count(*) AS total FROM thanks_messages").first<number>("total"),
    ).toBe(1)
  })

  test("creates a thanks and returns it with names", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "助けてくれてありがとう" },
    })

    expect(response.status).toBe(201)

    const parsed = thanksResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.sender_employee_id).toBe(toWorkforceEmployeeId(4))
      expect(parsed.data.recipient_employee_id).toBe(toWorkforceEmployeeId(5))
      expect(parsed.data.points).toBe(0)
      expect(parsed.data.message).toBe("助けてくれてありがとう")
    }
  })

  test("rejects sending thanks to yourself with 400", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E004", message: "自分にありがとう" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 for an unknown recipient", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E999", message: "ありがとう" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/thanks-messages",
      token: null,
      method: "POST",
      body: { recipient_employee_code: "E005", message: "ありがとう" },
    })

    expect(response.status).toBe(401)
  })

  test("maps a too-long message to 400 (invalid_thanks)", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "あ".repeat(1001) },
    })

    expect(response.status).toBe(400)
  })

  test("maps a whitespace-only message to 400 (invalid_thanks)", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "   " },
    })

    expect(response.status).toBe(400)
  })

  test("creates a notification for the recipient only", async () => {
    const db = await createTestDb()

    const sent = await request({
      db,
      path: "/thanks/thanks-messages",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "サポートに感謝します" },
    })

    expect(sent.status).toBe(201)

    const recipientInbox = await request({
      db,
      path: "/system/notifications",
      token: await recipientToken(),
    })

    const recipientRows = z
      .object({ notifications: z.array(notificationResponseSchema), total: z.number() })
      .safeParse(await recipientInbox.json())

    expect(recipientRows.success).toBe(true)

    if (recipientRows.success) {
      const thanksNotifications = recipientRows.data.notifications.filter(
        (row) => row.kind === "company:thanks",
      )

      expect(thanksNotifications.length).toBe(1)
      expect(thanksNotifications[0]?.source?.type).toBe("company:notification.source")
      expect(thanksNotifications[0]?.body).toBe("サポートに感謝します")
    }

    const senderInbox = await request({
      db,
      path: "/system/notifications",
      token: await senderToken(),
    })

    const senderRows = z
      .object({ notifications: z.array(notificationResponseSchema), total: z.number() })
      .safeParse(await senderInbox.json())

    expect(senderRows.success).toBe(true)

    if (senderRows.success) {
      expect(
        senderRows.data.notifications.filter((row) => row.kind === "company:thanks").length,
      ).toBe(0)
    }
  })
})

const thanksListResponseSchema = z.object({
  data: z.array(thanksResponseSchema),
  total: z.number(),
})

describe("GET /thanks-messages", () => {
  test("returns all thanks newest first for any employee", async () => {
    const db = await createTestDb()

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

    const response = await request({
      db,
      path: "/thanks/thanks-messages",
      token: await recipientToken(),
    })

    expect(response.status).toBe(200)

    const parsed = thanksListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(2)
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

    // 新着順は 3件目 → 2件目 → 1件目。offset=1, limit=1 で 2件目だけが返る。
    const response = await request({
      db,
      path: "/thanks/thanks-messages?limit=1&offset=1",
      token: await recipientToken(),
    })

    expect(response.status).toBe(200)

    const parsed = thanksListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.total).toBe(3)
      expect(parsed.data.data[0]?.message).toBe("2件目")
    }
  })

  test("falls back to the default limit when limit=0", async () => {
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
      path: "/thanks/thanks-messages?limit=0",
      token: await recipientToken(),
    })

    expect(response.status).toBe(200)

    const parsed = thanksListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // limit=0 は空配列でなく既定の 50 にフォールバックするため、全 3 件が返る。
      expect(parsed.data.data.length).toBe(3)
      expect(parsed.data.total).toBe(3)
    }
  })

  test("breaks created_at ties by id descending", async () => {
    const db = await createTestDb()

    // requestWithContext の既定 NOW で createdAt を固定し、タイブレークを id 降順で検証する。
    for (const message of ["古い", "新しい"]) {
      await request({
        db,
        path: "/thanks/thanks-messages",
        token: await senderToken(),
        method: "POST",
        body: { recipient_employee_code: "E005", message },
        now: "2026-01-01T00:00:00.000Z",
      })
    }

    const response = await request({
      db,
      path: "/thanks/thanks-messages",
      token: await recipientToken(),
      now: "2026-01-01T00:00:00.000Z",
    })

    const parsed = thanksListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.data[0]?.created_at).toBe(parsed.data.data[1]?.created_at)

      const firstId = parsed.data.data[0]?.id ?? 0

      const secondId = parsed.data.data[1]?.id ?? 0

      expect(firstId).toBeGreaterThan(secondId)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const db = await createTestDb()

    const response = await request({ db, path: "/thanks/thanks-messages", token: null })

    expect(response.status).toBe(401)
  })
})
