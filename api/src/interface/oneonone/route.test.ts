import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOneOnOnes } from "@/infrastructure/seed/seed-one-on-ones"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const oneOnOneResponseSchema = z.object({
  id: z.string(),
  held_at: z.string(),
  member_name: z.string(),
  manager_name: z.string(),
  topics: z.string().nullable(),
  manager_note: z.string().nullable(),
  next_action: z.string().nullable(),
})

const jwtSecret = "one-on-one-route-test-secret"

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
      role: employee.id === 4 ? "manager" : employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedD1(
    db,
    "one_on_ones",
    seedOneOnOnes.map((oneOnOne) => ({
      id: oneOnOne.id,
      member_id: oneOnOne.memberId,
      manager_id: oneOnOne.managerId,
      held_at: oneOnOne.heldAt,
      topics: oneOnOne.topics,
      manager_note: oneOnOne.managerNote,
      next_action: oneOnOne.nextAction,
    })),
  )

  return db
}

function managerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "manager",
  })
}

async function getRequest(token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path: "/oneonones", token })
}

async function postOneOnOne(token: string | null, body: unknown): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/oneonones",
    token,
    method: "POST",
    body,
    now: "2026-05-29T09:00:00Z",
  })
}

describe("GET /oneonones", () => {
  test("returns 200 with the participant's history in snake_case shape", async () => {
    const response = await getRequest(await managerToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(oneOnOneResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      const session = parsed.data.data.find((row) => row.held_at === "2026-05-01T05:00:00Z")

      expect(session?.member_name).toBe("Emery Lane")
      expect(session?.manager_name).toBe("Drew Sato")
      expect(session?.topics).toBe("Goal progress and career direction")
    }
  })

  test("returns an empty array for an employee with no sessions", async () => {
    const token = await createTestToken(jwtSecret, {
      employeeId: 1,
      email: "you+e001@example.com",
      role: "admin",
    })

    const response = await getRequest(token)

    expect(response.status).toBe(200)

    expect(await response.json()).toEqual({ data: [], total: 0 })
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest(null)

    expect(response.status).toBe(401)
  })
})

describe("POST /oneonones", () => {
  test("returns 201 and resolves member/manager into snake_case shape", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_email: "you+e005@example.com",
      topics: "Next challenge",
    })

    expect(response.status).toBe(201)

    const parsed = oneOnOneResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.member_name).toBe("Emery Lane")
      expect(parsed.data.manager_name).toBe("Drew Sato")
      expect(parsed.data.held_at).toBe("2026-05-29T09:00:00Z")
      expect(parsed.data.topics).toBe("Next challenge")
      expect(parsed.data.manager_note).toBeNull()
      expect(parsed.data.next_action).toBeNull()
      expect(parsed.data.id.length).toBeGreaterThan(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await postOneOnOne(null, {
      member_email: "you+e005@example.com",
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when member_email is missing", async () => {
    const response = await postOneOnOne(await managerToken(), { topics: "body only" })

    expect(response.status).toBe(400)
  })

  test("returns 400 when member and manager are the same person", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_email: "you+e004@example.com",
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 when the member email is unknown", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_email: "you+ghost@example.com",
    })

    expect(response.status).toBe(404)
  })
})
