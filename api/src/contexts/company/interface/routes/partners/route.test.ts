import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedPartners } from "@/contexts/company/infrastructure/seed/seed-partners"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "partner-route-test-secret"

const partnerResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  corporate_number: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const listSchema = z.object({
  data: z.array(partnerResponseSchema),
  total: z.number(),
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
    "partners",
    seedPartners.map((partner) => ({
      id: partner.id,
      code: partner.code,
      name: partner.name,
      category: partner.category,
      corporate_number: partner.corporateNumber,
      note: partner.note,
      status: partner.status,
      created_at: partner.createdAt,
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

describe("GET /partners", () => {
  test("returns 200 with all partners for any authenticated user", async () => {
    const response = await request("/partners", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
    }
  })

  test("filters by status", async () => {
    const response = await request("/partners?status=archived", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("archived")
    }
  })

  test("filters by keyword", async () => {
    const response = await request("/partners?q=商事", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("P0002")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/partners", null)

    expect(response.status).toBe(401)
  })
})

describe("GET /partners/:code", () => {
  test("returns 200 with the partner", async () => {
    const response = await request("/partners/P0001", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = partnerResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("P0001")
    }
  })

  test("returns 404 for unknown code", async () => {
    const response = await request("/partners/NOPE", await tokenFor(5, "member"))

    expect(response.status).toBe(404)
  })
})

describe("POST /partners", () => {
  test("creates a partner as admin", async () => {
    const response = await request("/partners", await tokenFor(1, "root"), "POST", {
      code: "P9001",
      name: "New Partner",
      category: "customer",
    })

    expect(response.status).toBe(201)

    const parsed = partnerResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("P9001")
      expect(parsed.data.status).toBe("active")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/partners", await tokenFor(5, "member"), "POST", {
      code: "P9002",
      name: "Blocked Partner",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 for a duplicate code", async () => {
    const response = await request("/partners", await tokenFor(1, "root"), "POST", {
      code: "P0001",
      name: "Duplicate",
    })

    expect(response.status).toBe(409)
  })
})

describe("PUT /partners/:id", () => {
  test("updates a partner as admin", async () => {
    const response = await request("/partners/1", await tokenFor(1, "root"), "PUT", {
      name: "Renamed Acme",
      category: "supplier",
    })

    expect(response.status).toBe(200)

    const parsed = partnerResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Renamed Acme")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/partners/1", await tokenFor(5, "member"), "PUT", {
      name: "Hijacked",
    })

    expect(response.status).toBe(403)
  })
})

describe("POST /partners/:id/archive", () => {
  test("archives a partner as admin", async () => {
    const response = await request("/partners/1/archive", await tokenFor(1, "root"), "POST")

    expect(response.status).toBe(204)
  })

  test("returns 403 for a member", async () => {
    const response = await request("/partners/1/archive", await tokenFor(5, "member"), "POST")

    expect(response.status).toBe(403)
  })

  test("returns 404 for unknown id", async () => {
    const response = await request("/partners/9999/archive", await tokenFor(1, "root"), "POST")

    expect(response.status).toBe(404)
  })
})
