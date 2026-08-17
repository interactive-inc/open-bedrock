import { describe, expect, test } from "bun:test"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createLifecycleRouteDb } from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { z } from "zod"

type OrgTreeNodeResponse = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: ReadonlyArray<OrgTreeNodeResponse>
}

const orgTreeNodeResponseSchema: z.ZodType<OrgTreeNodeResponse> = z.lazy(() =>
  z.object({
    code: z.string(),
    name: z.string(),
    manager_employee_code: z.string().nullable(),
    member_count: z.number(),
    children: z.array(orgTreeNodeResponseSchema),
  }),
)

const jwtSecret = "org-tree-route-test-secret"

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

describe("GET /departments/tree", () => {
  test("returns 200 with a recursive tree of root departments", async () => {
    const response = await request("/departments/tree", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(orgTreeNodeResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0]?.code).toBe("D001")
      expect(parsed.data[0]?.name).toBe("経営企画部")
      expect(parsed.data[0]?.children.length).toBe(4)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/departments/tree", null)

    expect(response.status).toBe(401)
  })

  test("derives current manager and member counts from lifecycle facts", async () => {
    const db = await createTestDb()
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/departments/tree",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)
    const roots = z.array(orgTreeNodeResponseSchema).parse(await response.json())
    const engineering = roots[0]?.children.find((department) => department.code === "D003")
    expect(engineering).toEqual(
      expect.objectContaining({ manager_employee_code: "E004", member_count: 2 }),
    )
  })
})
