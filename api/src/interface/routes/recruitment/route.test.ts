import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"

const jwtSecret = "recruitment-route-test-secret"

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

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

/** recruitment:manage を持つ admin(E001) で募集を1件作り、その id を返す。 */
async function createPosition(db: D1Database): Promise<number> {
  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/recruitment/positions",
    token: await tokenFor(1, "admin"),
    method: "POST",
    body: { title: "Backend Engineer", department_code: "D003" },
  })

  const body = (await response.json()) as { id: number }

  return body.id
}

describe("recruitment positions", () => {
  test("manager registers, lists and updates a position", async () => {
    const db = await createTestDb()

    const positionId = await createPosition(db)

    expect(positionId).toBeGreaterThan(0)

    const list = await requestWithContext({
      db,
      jwtSecret,
      path: "/recruitment/positions",
      token: await tokenFor(1, "admin"),
    })

    expect(list.status).toBe(200)

    const listBody = (await list.json()) as { data: Array<{ status: string }>; total: number }

    expect(listBody.total).toBe(1)

    expect(listBody.data[0]?.status).toBe("open")

    const updated = await requestWithContext({
      db,
      jwtSecret,
      path: `/recruitment/positions/${positionId}`,
      token: await tokenFor(1, "admin"),
      method: "PUT",
      body: { title: "Backend Engineer", status: "closed" },
    })

    expect(updated.status).toBe(200)

    const updatedBody = (await updated.json()) as { status: string }

    expect(updatedBody.status).toBe("closed")
  })

  test("member without recruitment:manage cannot list positions (社外個人情報の親のため閲覧も 403)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/recruitment/positions",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("member without recruitment:manage cannot create a position", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/recruitment/positions",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { title: "x" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/recruitment/positions",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("recruitment candidates", () => {
  test("registers a candidate (applied) and advances through stages", async () => {
    const db = await createTestDb()

    const positionId = await createPosition(db)

    const created = await requestWithContext({
      db,
      jwtSecret,
      path: `/recruitment/positions/${positionId}/candidates`,
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { name: "Applicant One", email: "applicant@example.com" },
    })

    expect(created.status).toBe(201)

    const candidate = (await created.json()) as { id: number; stage: string }

    expect(candidate.stage).toBe("applied")

    const advanced = await requestWithContext({
      db,
      jwtSecret,
      path: `/recruitment/candidates/${candidate.id}/advance`,
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { stage: "screening" },
    })

    expect(advanced.status).toBe(200)

    const advancedBody = (await advanced.json()) as { stage: string }

    expect(advancedBody.stage).toBe("screening")
  })

  test("rejects an invalid stage transition with 409", async () => {
    const db = await createTestDb()

    const positionId = await createPosition(db)

    const created = await requestWithContext({
      db,
      jwtSecret,
      path: `/recruitment/positions/${positionId}/candidates`,
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { name: "Applicant Two" },
    })

    const candidate = (await created.json()) as { id: number }

    // applied から interview へ飛ばすのは正順違反。
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/recruitment/candidates/${candidate.id}/advance`,
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { stage: "interview" },
    })

    expect(response.status).toBe(409)
  })

  test("member without recruitment:manage cannot list candidates (社外個人情報のため 403)", async () => {
    const db = await createTestDb()

    const positionId = await createPosition(db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/recruitment/positions/${positionId}/candidates`,
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })
})
