import { describe, expect, test } from "bun:test"
import {
  seedRegulations,
  seedRegulationVersions,
} from "@/contexts/regulation/infrastructure/seed/seed-regulations"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "regulation-route-test-secret"

const listItemSchema = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  latest_version: z.number().nullable(),
  effective_on: z.string().nullable(),
  created_at: z.string(),
})

const listSchema = z.object({
  data: z.array(listItemSchema),
  total: z.number(),
})

const versionSchema = z.object({
  id: z.number(),
  version: z.number(),
  body_md: z.string(),
  effective_on: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

const detailSchema = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  latest_version: versionSchema.nullable(),
  versions: z.array(versionSchema),
})

const regulationSchema = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
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
    "regulations",
    seedRegulations.map((regulation) => ({
      id: regulation.id,
      code: regulation.code,
      title: regulation.title,
      category: regulation.category,
      status: regulation.status,
      created_at: regulation.createdAt,
    })),
  )

  await seedD1(
    db,
    "regulation_versions",
    seedRegulationVersions.map((version) => ({
      id: version.id,
      regulation_id: version.regulationId,
      version: version.version,
      body_md: version.bodyMd,
      effective_on: version.effectiveOn,
      note: version.note,
      created_at: version.createdAt,
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

describe("GET /regulations", () => {
  test("any authenticated user sees the list with latest version metadata", async () => {
    const response = await request("/regulations", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)

      const workRules = parsed.data.data.find((item) => item.code === "REG-001")

      expect(workRules?.latest_version).toBe(2)
      expect(workRules?.effective_on).toBe("2026-04-01")
    }
  })

  test("filters by status", async () => {
    const response = await request("/regulations?status=archived", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("REG-003")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/regulations", null)

    expect(response.status).toBe(401)
  })
})

describe("GET /regulations/:code", () => {
  test("returns latest version and full version list", async () => {
    const response = await request("/regulations/REG-001", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = detailSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.versions.length).toBe(2)
      expect(parsed.data.latest_version?.version).toBe(2)
      // 版一覧は新しい版が先頭。
      expect(parsed.data.versions[0]?.version).toBe(2)
    }
  })

  test("returns 404 for unknown code", async () => {
    const response = await request("/regulations/NOPE", await tokenFor(5, "member"))

    expect(response.status).toBe(404)
  })
})

describe("POST /regulations", () => {
  test("admin creates a regulation with an initial version", async () => {
    const response = await request("/regulations", await tokenFor(1, "root"), "POST", {
      code: "REG-100",
      title: "New Policy",
      body_md: "the policy body",
      effective_on: "2026-08-01",
    })

    expect(response.status).toBe(201)

    const parsed = regulationSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("REG-100")
      expect(parsed.data.status).toBe("active")
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/regulations", await tokenFor(5, "member"), "POST", {
      code: "REG-101",
      title: "Blocked",
      body_md: "no",
      effective_on: "2026-08-01",
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code conflicts", async () => {
    const response = await request("/regulations", await tokenFor(1, "root"), "POST", {
      code: "REG-001",
      title: "Dup",
      body_md: "dup",
      effective_on: "2026-08-01",
    })

    expect(response.status).toBe(409)
  })
})

describe("POST /regulations/:code/versions", () => {
  test("admin adds the next version", async () => {
    const response = await request(
      "/regulations/REG-002/versions",
      await tokenFor(1, "root"),
      "POST",
      {
        body_md: "revised travel rules",
        effective_on: "2026-10-01",
        note: "annual update",
      },
    )

    expect(response.status).toBe(201)

    const parsed = versionSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // REG-002 had version 1, so the next is 2.
      expect(parsed.data.version).toBe(2)
    }
  })

  test("member is forbidden", async () => {
    const response = await request(
      "/regulations/REG-002/versions",
      await tokenFor(5, "member"),
      "POST",
      { body_md: "x", effective_on: "2026-10-01" },
    )

    expect(response.status).toBe(403)
  })
})

describe("POST /regulations/:code/archive", () => {
  test("admin archives a regulation", async () => {
    const response = await request(
      "/regulations/REG-001/archive",
      await tokenFor(1, "root"),
      "POST",
    )

    expect(response.status).toBe(200)

    const parsed = regulationSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("archived")
    }
  })
})
