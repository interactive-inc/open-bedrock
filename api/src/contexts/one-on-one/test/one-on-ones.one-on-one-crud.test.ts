import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees.repository"
import { seedOneOnOnes } from "@/contexts/one-on-one/infrastructure/seed/seed-one-on-ones.repository"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
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

const jwtSecret = "one-on-one-crud-test-secret"

/** seed: manager 4 が記録した 1on1（member 5） */
const ownOneOnOneId = "00000000-0000-0000-0000-000000000001"

/** seed: manager 9 が記録した 1on1（manager 4 から見て他人の記録） */
const othersOneOnOneId = "00000000-0000-0000-0000-000000000003"

const unknownId = "ffffffff-ffff-ffff-ffff-ffffffffffff"

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

/** seed #1 のメンバー（member 5）。参加者として閲覧できるが記録の編集・削除はできない。 */
function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /one-on-ones/me", () => {
  test("returns the participant's history in snake_case shape", async () => {
    const response = await request({ path: "/one-on-ones/me", token: await managerToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(oneOnOneResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/one-on-ones/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /one-on-ones/:id", () => {
  test("returns the one-on-one for the recording manager", async () => {
    const response = await request({
      path: `/one-on-ones/${ownOneOnOneId}`,
      token: await managerToken(),
    })

    expect(response.status).toBe(200)

    const parsed = oneOnOneResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownOneOnOneId)
    }
  })

  test("returns the one-on-one for its member participant", async () => {
    const response = await request({
      path: `/one-on-ones/${ownOneOnOneId}`,
      token: await memberToken(),
    })

    expect(response.status).toBe(200)
  })

  test("returns 403 for a non-participant", async () => {
    const response = await request({
      path: `/one-on-ones/${othersOneOnOneId}`,
      token: await managerToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown one-on-one", async () => {
    const response = await request({
      path: `/one-on-ones/${unknownId}`,
      token: await managerToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /one-on-ones/:id", () => {
  test("updates the record content for the recording manager", async () => {
    const response = await request({
      path: `/one-on-ones/${ownOneOnOneId}`,
      token: await managerToken(),
      method: "PUT",
      body: {
        topics: "Updated topics",
        manager_note: "Updated note",
        next_action: "Updated action",
      },
    })

    expect(response.status).toBe(200)

    const parsed = oneOnOneResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.topics).toBe("Updated topics")
      expect(parsed.data.manager_note).toBe("Updated note")
      expect(parsed.data.next_action).toBe("Updated action")
    }
  })

  test("returns 403 when a member tries to edit the record", async () => {
    const response = await request({
      path: `/one-on-ones/${ownOneOnOneId}`,
      token: await memberToken(),
      method: "PUT",
      body: { topics: "hijack" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown one-on-one", async () => {
    const response = await request({
      path: `/one-on-ones/${unknownId}`,
      token: await managerToken(),
      method: "PUT",
      body: { topics: "x" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/one-on-ones/${ownOneOnOneId}`,
      token: null,
      method: "PUT",
      body: { topics: "x" },
    })

    expect(response.status).toBe(401)
  })
})

describe("DELETE /one-on-ones/:id", () => {
  test("deletes the record for the recording manager and returns 204", async () => {
    const response = await request({
      path: `/one-on-ones/${ownOneOnOneId}`,
      token: await managerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when a member tries to delete the record", async () => {
    const response = await request({
      path: `/one-on-ones/${ownOneOnOneId}`,
      token: await memberToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown one-on-one", async () => {
    const response = await request({
      path: `/one-on-ones/${unknownId}`,
      token: await managerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/one-on-ones/${ownOneOnOneId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
