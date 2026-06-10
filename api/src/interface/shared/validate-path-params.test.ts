import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"

// 共通バリデーションヘルパー（validateUuidParam / validateIntParam / validateCodeParam）が
// 不正なパスパラメータで 404 を返すことを、代表ルート経由で検証する。

const jwtSecret = "validate-path-params-test-secret"

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

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

async function request(props: { path: string; method?: string }): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: await adminToken(),
    method: props.method,
  })
}

// UUID 形式のパスパラメータ検証
describe("UUID path param validation", () => {
  // family-care-leave は代表的な UUID ID ルート
  test("returns 404 for an empty UUID param", async () => {
    // Hono のルーティングでは :id が空になることは通常ないが、
    // 不正な形式が渡された場合を検証する
    const response = await request({ path: "/family-care-leaves/not-a-uuid" })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a numeric ID on a UUID route", async () => {
    const response = await request({ path: "/family-care-leaves/12345" })

    expect(response.status).toBe(404)
  })

  test("returns 404 for an overly long string on a UUID route", async () => {
    const response = await request({ path: `/family-care-leaves/${"a".repeat(200)}` })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a UUID without hyphens", async () => {
    const response = await request({ path: "/business-trips/550e8400e29b41d4a716446655440000" })

    expect(response.status).toBe(404)
  })

  test("returns 404 for an uppercase UUID", async () => {
    const response = await request({ path: "/business-trips/550E8400-E29B-41D4-A716-446655440000" })

    expect(response.status).toBe(404)
  })
})

// 数値 ID のパスパラメータ検証
describe("integer path param validation", () => {
  // notification は代表的な数値 ID ルート
  test("returns 404 for a non-numeric string", async () => {
    const response = await request({ path: "/notifications/abc" })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a decimal number", async () => {
    const response = await request({ path: "/notifications/3.14" })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a negative number", async () => {
    const response = await request({ path: "/notifications/-1" })

    expect(response.status).toBe(404)
  })

  test("returns 404 for zero", async () => {
    const response = await request({ path: "/notifications/0" })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a mixed string like '50abc'", async () => {
    const response = await request({ path: "/notifications/50abc" })

    expect(response.status).toBe(404)
  })
})

// コード系パスパラメータ検証
describe("code path param validation", () => {
  // employee/:code は代表的なコード系ルート
  test("returns 404 for a code exceeding 64 characters", async () => {
    const response = await request({ path: `/employees/${"x".repeat(65)}` })

    expect(response.status).toBe(404)
  })
})
