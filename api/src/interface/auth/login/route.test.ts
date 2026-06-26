import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "auth-login-route-test-secret"

const loginResponseSchema = z.object({
  access_token: z.string(),
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

  return db
}

async function postLogin(body: unknown): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/auth/login",
    token: null,
    method: "POST",
    body,
  })
}

describe("POST /auth/login", () => {
  test("returns 200 and an access_token for valid credentials", async () => {
    const response = await postLogin({ email: "you+e001@example.com", password: "password" })

    expect(response.status).toBe(200)

    const parsed = loginResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.access_token.length > 0).toBe(true)
    }
  })

  test("returns 401 for a wrong password", async () => {
    const response = await postLogin({ email: "you+e001@example.com", password: "wrong" })

    expect(response.status).toBe(401)
  })

  test("returns 401 for an unknown email", async () => {
    const response = await postLogin({ email: "you+ghost@example.com", password: "password" })

    expect(response.status).toBe(401)
  })

  test("returns 400 when required fields are missing", async () => {
    const response = await postLogin({ email: "you+e001@example.com" })

    expect(response.status).toBe(400)
  })

  test("returns 401 for a retired employee with the correct password (#775)", async () => {
    // E018 は seed 上 retired。資格情報エラーと同一の 401 を返す。
    const response = await postLogin({ email: "you+e018@example.com", password: "password" })

    expect(response.status).toBe(401)
  })

  test("returns 200 for a leave employee (#775, leave は現状許可)", async () => {
    // E017 は seed 上 leave。休職中のログインは現仕様で許可。
    const response = await postLogin({ email: "you+e017@example.com", password: "password" })

    expect(response.status).toBe(200)
  })
})
