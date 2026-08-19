import { describe, expect, test } from "bun:test"
import { seedAnnouncements } from "@/contexts/announcement/infrastructure/seed/seed-announcements"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "announcement-route-test-secret"

const listItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.string(),
  published_on: z.string().nullable(),
  author_employee_id: z.number(),
  created_at: z.string(),
})

const listSchema = z.object({
  data: z.array(listItemSchema),
  total: z.number(),
})

const announcementSchema = z.object({
  id: z.number(),
  title: z.string(),
  body_md: z.string(),
  status: z.string(),
  published_on: z.string().nullable(),
  author_employee_id: z.number(),
  created_at: z.string(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await seedD1(
    db,
    "announcements",
    seedAnnouncements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body_md: announcement.bodyMd,
      published_on: announcement.publishedOn,
      author_employee_id: announcement.authorEmployeeId,
      status: announcement.status,
      created_at: announcement.createdAt,
    })),
  )

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
  })
}

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token, method, body })
}

describe("GET /announcements", () => {
  test("returns only published for a member", async () => {
    const response = await request("/announcements", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.status === "published")).toBe(true)
      expect(parsed.data.data.length).toBe(2)
    }
  })

  test("admin can filter drafts via status query", async () => {
    const response = await request("/announcements?status=draft", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("draft")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/announcements", null)

    expect(response.status).toBe(401)
  })
})

describe("GET /announcements/:id", () => {
  test("member can read a published announcement", async () => {
    const response = await request("/announcements/1", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = announcementSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)
  })

  test("member gets 404 for a draft announcement", async () => {
    const response = await request("/announcements/3", await tokenFor(5, "member"))

    expect(response.status).toBe(404)
  })

  test("admin can read a draft announcement", async () => {
    const response = await request("/announcements/3", await tokenFor(1, "root"))

    expect(response.status).toBe(200)
  })
})

describe("POST /announcements", () => {
  test("admin creates a draft announcement", async () => {
    const response = await request("/announcements", await tokenFor(1, "root"), "POST", {
      title: "New Announcement",
      body_md: "hello everyone",
    })

    expect(response.status).toBe(201)

    const parsed = announcementSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("draft")
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/announcements", await tokenFor(5, "member"), "POST", {
      title: "Blocked",
      body_md: "no",
    })

    expect(response.status).toBe(403)
  })
})

describe("PUT /announcements/:id", () => {
  test("admin updates title and body", async () => {
    const response = await request("/announcements/3", await tokenFor(1, "root"), "PUT", {
      title: "Updated Draft",
      body_md: "updated body",
    })

    expect(response.status).toBe(200)

    const parsed = announcementSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("Updated Draft")
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/announcements/3", await tokenFor(5, "member"), "PUT", {
      title: "x",
      body_md: "y",
    })

    expect(response.status).toBe(403)
  })
})

describe("POST /announcements/:id/publish", () => {
  test("publishing a draft sets it published and notifies active employees", async () => {
    const db = await createTestDb()

    const now = "2026-07-01T00:00:00.000Z"

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/announcements/3/publish",
      token: await tokenFor(1, "root"),
      method: "POST",
      now,
    })

    expect(response.status).toBe(200)

    const parsed = announcementSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("published")
      expect(parsed.data.published_on).toBe("2026-07-01")
    }

    const notificationCount = await db
      .prepare(
        `SELECT count(*) AS total
         FROM system_notification_messages
         WHERE source_type = 'company:notification.source'
           AND json_extract(source_id, '$.domain') = 'announcement'`,
      )
      .first("total")

    // active 従業員数ぶんの通知が届く（seed の active 従業員は 12 名）。
    expect(Number(notificationCount)).toBeGreaterThan(0)
  })

  test("member is forbidden", async () => {
    const response = await request("/announcements/3/publish", await tokenFor(5, "member"), "POST")

    expect(response.status).toBe(403)
  })
})

describe("POST /announcements/:id/archive", () => {
  test("admin archives an announcement", async () => {
    const response = await request("/announcements/1/archive", await tokenFor(1, "root"), "POST")

    expect(response.status).toBe(200)

    const parsed = announcementSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("archived")
    }
  })
})
