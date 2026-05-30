import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "auth-me-route-test-secret"

const meResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
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

  return db
}

async function getMe(token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path: "/me", token })
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

describe("GET /me", () => {
  test("returns 200 and the employee in CLI whoami shape", async () => {
    const response = await getMe(await adminToken())

    expect(response.status).toBe(200)

    const parsed = meResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.code).toBe("E001")
      expect(parsed.data.email).toBe("you+e001@example.com")
      expect(parsed.data.role).toBe("admin")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getMe(null)

    expect(response.status).toBe(401)
  })

  test("returns 401 for an invalid token", async () => {
    const response = await getMe("not-a-real-token")

    expect(response.status).toBe(401)
  })

  test("returns 404 when the token employee does not exist", async () => {
    const token = await createTestToken(jwtSecret, {
      employeeId: 9999,
      email: "you+ghost@example.com",
      role: "member",
    })

    const response = await getMe(token)

    expect(response.status).toBe(404)
  })
})
