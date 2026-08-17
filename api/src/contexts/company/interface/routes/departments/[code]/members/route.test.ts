import { describe, expect, test } from "bun:test"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createLifecycleRouteDb } from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { z } from "zod"

const orgMemberResponseSchema = z.object({
  employee_code: z.string(),
  employee_name: z.string(),
  position: z.string().nullable(),
  manager_employee_code: z.string().nullable(),
  is_manager: z.boolean(),
})

const jwtSecret = "org-department-members-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  return createLifecycleRouteDb()
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /departments/:code/members", () => {
  test("returns 200 with snake_case members and is_manager flag", async () => {
    const response = await request("/departments/D003/members", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(orgMemberResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)

      const manager = parsed.data.find((member) => member.employee_code === "E004")

      expect(manager?.is_manager).toBe(true)
      expect(manager?.employee_name).toBe("Drew Sato")
      expect(manager?.position).toBe("Manager")

      const memberE005 = parsed.data.find((member) => member.employee_code === "E005")

      expect(memberE005?.is_manager).toBe(false)
    }
  })

  test("returns 404 for an unknown department code", async () => {
    const response = await request("/departments/D999/members", await memberToken())

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/departments/D003/members", null)

    expect(response.status).toBe(401)
  })
})
