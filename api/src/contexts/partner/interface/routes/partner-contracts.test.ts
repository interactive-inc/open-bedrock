import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedPartners } from "@/contexts/partner/test/seed/seed-partners.test-support"
import { seedContracts } from "@/contexts/partner/test/seed/seed-contracts.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "contract-route-test-secret"

const contractResponseSchema = z.object({
  id: z.number(),
  partner_id: z.number(),
  title: z.string(),
  contract_date: z.string(),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  renewal_deadline: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

const listSchema = z.object({
  data: z.array(contractResponseSchema),
  total: z.number(),
})

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
    "partners",
    seedPartners.map((partner) => ({
      id: partner.id,
      code: partner.code,
      name: partner.name,
      category: partner.category,
      corporate_number: partner.corporateNumber,
      note: partner.note,
      status: partner.status,
      created_at: partner.createdAt,
    })),
  )

  await seedD1(
    db,
    "partner_contracts",
    seedContracts.map((contract) => ({
      id: contract.id,
      partner_id: contract.partnerId,
      title: contract.title,
      contract_date: contract.contractDate,
      starts_on: contract.startsOn,
      ends_on: contract.endsOn,
      renewal_deadline: contract.renewalDeadline,
      note: contract.note,
      created_at: contract.createdAt,
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

describe("GET /partner-contracts", () => {
  test("returns 200 with all contracts for a read:all viewer (admin)", async () => {
    const response = await request("/partner/partner-contracts", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
    }
  })

  test("filters by partner_id", async () => {
    const response = await request("/partner/partner-contracts?partner_id=1", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.partner_id).toBe(1)
    }
  })

  test("returns 403 for a viewer without read:all (member)", async () => {
    const response = await request("/partner/partner-contracts", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/partner/partner-contracts", null)

    expect(response.status).toBe(401)
  })
})

describe("POST /partner-contracts", () => {
  test("creates a contract as admin", async () => {
    const response = await request("/partner/partner-contracts", await tokenFor(1), "POST", {
      partner_id: 1,
      title: "New Agreement",
      contract_date: "2026-02-01",
      renewal_deadline: "2026-12-31",
    })

    expect(response.status).toBe(201)

    const parsed = contractResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("New Agreement")
      expect(parsed.data.partner_id).toBe(1)
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/partner/partner-contracts", await tokenFor(5), "POST", {
      partner_id: 1,
      title: "Blocked",
      contract_date: "2026-02-01",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown partner", async () => {
    const response = await request("/partner/partner-contracts", await tokenFor(1), "POST", {
      partner_id: 9999,
      title: "Ghost",
      contract_date: "2026-02-01",
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /partner-contracts/:id", () => {
  test("updates a contract as admin", async () => {
    const response = await request("/partner/partner-contracts/1", await tokenFor(1), "PUT", {
      title: "Amended Agreement",
      contract_date: "2026-01-15",
      renewal_deadline: "2026-11-30",
    })

    expect(response.status).toBe(200)

    const parsed = contractResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("Amended Agreement")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/partner/partner-contracts/1", await tokenFor(5), "PUT", {
      title: "Hijacked",
      contract_date: "2026-01-15",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for unknown id", async () => {
    const response = await request("/partner/partner-contracts/9999", await tokenFor(1), "PUT", {
      title: "Missing",
      contract_date: "2026-01-15",
    })

    expect(response.status).toBe(404)
  })
})
