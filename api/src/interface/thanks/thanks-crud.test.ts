import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"
import { z } from "zod"

const thanksResponseSchema = z.object({
  id: z.number(),
  sender_employee_id: z.number(),
  sender_name: z.string(),
  recipient_employee_id: z.number(),
  recipient_name: z.string(),
  message: z.string(),
  points: z.number(),
  created_at: z.string(),
})

const notificationResponseSchema = z.object({
  id: z.number().nullable(),
  kind: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  source_domain: z.string(),
  source_id: z.number().nullable(),
})

const jwtSecret = "thanks-crud-test-secret"

// seed: E004 Drew Sato（id 4）が送り手、E005 Emery Lane（id 5）が受け手
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  return db
}

function senderToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "member",
  })
}

function recipientToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
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

describe("POST /thanks", () => {
  test("creates a thanks and returns it with names", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "助けてくれてありがとう" },
    })

    expect(response.status).toBe(201)

    const parsed = thanksResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.sender_employee_id).toBe(4)
      expect(parsed.data.recipient_employee_id).toBe(5)
      expect(parsed.data.points).toBe(0)
      expect(parsed.data.message).toBe("助けてくれてありがとう")
    }
  })

  test("rejects sending thanks to yourself with 400", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks",
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
      path: "/thanks",
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
      path: "/thanks",
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
      path: "/thanks",
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
      path: "/thanks",
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
      path: "/thanks",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "サポートに感謝します" },
    })

    expect(sent.status).toBe(201)

    const recipientInbox = await request({
      db,
      path: "/notifications/me",
      token: await recipientToken(),
    })

    const recipientRows = z
      .object({ data: z.array(notificationResponseSchema), total: z.number() })
      .safeParse(await recipientInbox.json())

    expect(recipientRows.success).toBe(true)

    if (recipientRows.success) {
      const thanksNotifications = recipientRows.data.data.filter((row) => row.kind === "thanks")

      expect(thanksNotifications.length).toBe(1)
      expect(thanksNotifications[0]?.source_domain).toBe("thanks")
      expect(thanksNotifications[0]?.body).toBe("サポートに感謝します")
    }

    const senderInbox = await request({ db, path: "/notifications/me", token: await senderToken() })

    const senderRows = z
      .object({ data: z.array(notificationResponseSchema), total: z.number() })
      .safeParse(await senderInbox.json())

    expect(senderRows.success).toBe(true)

    if (senderRows.success) {
      expect(senderRows.data.data.filter((row) => row.kind === "thanks").length).toBe(0)
    }
  })
})

const thanksListResponseSchema = z.object({
  data: z.array(thanksResponseSchema),
  total: z.number(),
})

describe("GET /thanks", () => {
  test("returns all thanks newest first for any employee", async () => {
    const db = await createTestDb()

    await request({
      db,
      path: "/thanks",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "1件目" },
    })

    await request({
      db,
      path: "/thanks",
      token: await senderToken(),
      method: "POST",
      body: { recipient_employee_code: "E005", message: "2件目" },
    })

    const response = await request({ db, path: "/thanks", token: await recipientToken() })

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
        path: "/thanks",
        token: await senderToken(),
        method: "POST",
        body: { recipient_employee_code: "E005", message },
      })
    }

    // 新着順は 3件目 → 2件目 → 1件目。offset=1, limit=1 で 2件目だけが返る。
    const response = await request({
      db,
      path: "/thanks?limit=1&offset=1",
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
        path: "/thanks",
        token: await senderToken(),
        method: "POST",
        body: { recipient_employee_code: "E005", message },
      })
    }

    const response = await request({ db, path: "/thanks?limit=0", token: await recipientToken() })

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
        path: "/thanks",
        token: await senderToken(),
        method: "POST",
        body: { recipient_employee_code: "E005", message },
        now: "2026-01-01T00:00:00.000Z",
      })
    }

    const response = await request({
      db,
      path: "/thanks",
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

    const response = await request({ db, path: "/thanks", token: null })

    expect(response.status).toBe(401)
  })
})
