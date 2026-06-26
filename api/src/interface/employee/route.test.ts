import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "employee-route-test-secret"

const employeeResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
  email: z.string(),
  status: z.string(),
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
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /employees", () => {
  test("returns 200 with every employee in CLI response shape", async () => {
    const response = await request("/employees", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(14)

      const lead = parsed.data.data.find((employee) => employee.code === "E001")

      expect(lead?.name).toBe("Alex Carter")
      expect(lead?.dept_name).toBe("Corporate Planning")
      expect(lead?.position).toBe("CTO")
      expect(lead?.email).toBe("you+e001@example.com")
      expect(lead?.status).toBe("active")
    }
  })

  test("never leaks passwordHash id deptId deptName or role", async () => {
    const response = await request("/employees", await adminToken())

    const parsed = z
      .object({ data: z.array(z.record(z.string(), z.unknown())), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      for (const row of parsed.data.data) {
        expect("passwordHash" in row).toBe(false)
        expect("password_hash" in row).toBe(false)
        expect("id" in row).toBe(false)
        expect("deptId" in row).toBe(false)
        expect("deptName" in row).toBe(false)
        expect("role" in row).toBe(false)
      }
    }
  })

  test("filters by keyword via q", async () => {
    const response = await request("/employees?q=Drew", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("E004")
    }
  })

  test("treats % as a literal so it cannot match every employee", async () => {
    const response = await request("/employees?q=%25", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("treats _ as a literal so it cannot match a single character", async () => {
    const response = await request("/employees?q=_", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("filters by department name via dept", async () => {
    const response = await request("/employees?dept=Engineering", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
    }
  })

  test("filters by status", async () => {
    const response = await request("/employees?status=active", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(12)
    }
  })

  test("filters by status leave", async () => {
    const response = await request("/employees?status=leave", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("E017")
    }
  })

  test("filters by status retired", async () => {
    const response = await request("/employees?status=retired", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("E018")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/employees", null)

    expect(response.status).toBe(401)
  })

  test("returns 401 with an invalid bearer token", async () => {
    const response = await request("/employees", "not-a-real-token")

    expect(response.status).toBe(401)
  })

  test("returns 400 when status is outside the allowed set", async () => {
    const response = await request("/employees?status=unknown", await adminToken())

    expect(response.status).toBe(400)
  })

  test("returns 404 for an unregistered path", async () => {
    const response = await request("/employees/extra", await adminToken())

    expect(response.status).toBe(404)
  })
})
