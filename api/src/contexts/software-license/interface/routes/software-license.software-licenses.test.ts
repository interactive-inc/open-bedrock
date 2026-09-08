import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedLicenses } from "@/contexts/software-license/test/seed/seed-licenses.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "license-route-test-secret"

const licenseSchema = z.object({
  id: z.number(),
  name: z.string(),
  vendor: z.string().nullable(),
  category: z.string().nullable(),
  seats: z.number().nullable(),
  renewal_deadline: z.string().nullable(),
  owner_employee_id: zEmployeeId.nullable(),
  note: z.string().nullable(),
  status: z.enum(["active", "cancelled"]),
  created_at: z.string(),
})

const listSchema = z.object({ data: z.array(licenseSchema), total: z.number() })

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await seedD1(
    db,
    "software_licenses",
    seedLicenses.map((license) => ({
      id: license.id,
      name: license.name,
      vendor: license.vendor,
      category: license.category,
      seats: license.seats,
      renewal_deadline: license.renewalDeadline,
      owner_employee_id: license.ownerEmployeeId,
      note: license.note,
      status: license.status,
      created_at: license.createdAt,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
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

describe("GET /software-licenses", () => {
  test("returns 200 with all licenses for a read:all viewer (admin)", async () => {
    const response = await request("/software-license/software-licenses", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
    }
  })

  test("returns 403 for a viewer without read:all (member)", async () => {
    const response = await request("/software-license/software-licenses", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/software-license/software-licenses", null)

    expect(response.status).toBe(401)
  })
})

describe("POST /software-licenses", () => {
  test("creates a license as admin", async () => {
    const response = await request(
      "/software-license/software-licenses",
      await tokenFor(1),
      "POST",
      {
        name: "New SaaS",
        category: "saas",
        seats: 5,
        renewal_deadline: "2027-01-31",
      },
    )

    expect(response.status).toBe(201)

    const parsed = licenseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("New SaaS")
      expect(parsed.data.status).toBe("active")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request(
      "/software-license/software-licenses",
      await tokenFor(5),
      "POST",
      {
        name: "Blocked",
      },
    )

    expect(response.status).toBe(403)
  })
})

describe("PUT /software-licenses/:id", () => {
  test("updates a license as admin", async () => {
    const response = await request(
      "/software-license/software-licenses/1",
      await tokenFor(1),
      "PUT",
      {
        name: "Renamed Tracker",
        seats: 60,
        renewal_deadline: "2026-04-30",
      },
    )

    expect(response.status).toBe(200)

    const parsed = licenseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Renamed Tracker")
      expect(parsed.data.seats).toBe(60)
    }
  })

  test("returns 404 for unknown id", async () => {
    const response = await request(
      "/software-license/software-licenses/9999",
      await tokenFor(1),
      "PUT",
      {
        name: "Missing",
      },
    )

    expect(response.status).toBe(404)
  })
})

describe("POST /software-licenses/:id/cancel", () => {
  test("cancels a license as admin", async () => {
    const response = await request(
      "/software-license/software-licenses/1/cancel",
      await tokenFor(1),
      "POST",
    )

    expect(response.status).toBe(200)

    const parsed = licenseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("cancelled")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request(
      "/software-license/software-licenses/1/cancel",
      await tokenFor(5),
      "POST",
    )

    expect(response.status).toBe(403)
  })
})
