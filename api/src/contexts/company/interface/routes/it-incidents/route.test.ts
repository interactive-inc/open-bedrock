import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedItIncidents } from "@/contexts/company/infrastructure/seed/seed-it-incidents"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "it-incident-route-test-secret"

const incidentSchema = z.object({
  id: z.number(),
  occurred_at: z.string(),
  title: z.string(),
  summary: z.string(),
  severity: z.string().nullable(),
  status: z.enum(["open", "resolved"]),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
})

const listSchema = z.object({ data: z.array(incidentSchema), total: z.number() })

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
    "it_incidents",
    seedItIncidents.map((incident) => ({
      id: incident.id,
      occurred_at: incident.occurredAt,
      title: incident.title,
      summary: incident.summary,
      severity: incident.severity,
      status: incident.status,
      resolved_at: incident.resolvedAt,
      created_at: incident.createdAt,
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

describe("GET /it-incidents", () => {
  test("returns 200 with all incidents for a read:all viewer (admin)", async () => {
    const response = await request("/it-incidents", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
    }
  })

  test("filters by status=open", async () => {
    const response = await request("/it-incidents?status=open", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("open")
    }
  })

  test("returns 403 for a viewer without read:all (member)", async () => {
    const response = await request("/it-incidents", await tokenFor(5, "member"))

    expect(response.status).toBe(403)
  })
})

describe("POST /it-incidents", () => {
  test("creates an incident as admin", async () => {
    const response = await request("/it-incidents", await tokenFor(1, "root"), "POST", {
      occurred_at: "2026-03-01T10:00:00Z",
      title: "Disk full",
      summary: "A server ran out of disk space.",
      severity: "medium",
    })

    expect(response.status).toBe(201)

    const parsed = incidentSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("open")
      expect(parsed.data.resolved_at).toBeNull()
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/it-incidents", await tokenFor(5, "member"), "POST", {
      occurred_at: "2026-03-01T10:00:00Z",
      title: "Blocked",
      summary: "Should not be created.",
    })

    expect(response.status).toBe(403)
  })
})

describe("POST /it-incidents/:id/resolve", () => {
  test("resolves an open incident as admin", async () => {
    const response = await request("/it-incidents/2/resolve", await tokenFor(1, "root"), "POST")

    expect(response.status).toBe(200)

    const parsed = incidentSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("resolved")
      expect(parsed.data.resolved_at).not.toBeNull()
    }
  })

  test("returns 409 when already resolved", async () => {
    const response = await request("/it-incidents/1/resolve", await tokenFor(1, "root"), "POST")

    expect(response.status).toBe(409)
  })

  test("returns 403 for a member", async () => {
    const response = await request("/it-incidents/2/resolve", await tokenFor(5, "member"), "POST")

    expect(response.status).toBe(403)
  })
})
