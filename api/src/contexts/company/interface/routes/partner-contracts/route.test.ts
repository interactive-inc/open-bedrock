import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedPartners } from "@/contexts/company/infrastructure/seed/seed-partners"
import { seedContracts } from "@/contexts/company/infrastructure/seed/seed-contracts"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

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

describe("GET /partner-contracts", () => {
  test("returns 200 with all contracts for a read:all viewer (admin)", async () => {
    const response = await request("/partner-contracts", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
    }
  })

  test("filters by partner_id", async () => {
    const response = await request("/partner-contracts?partner_id=1", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.partner_id).toBe(1)
    }
  })

  test("returns 403 for a viewer without read:all (member)", async () => {
    const response = await request("/partner-contracts", await tokenFor(5, "member"))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/partner-contracts", null)

    expect(response.status).toBe(401)
  })
})

describe("POST /partner-contracts", () => {
  test("creates a contract as admin", async () => {
    const response = await request("/partner-contracts", await tokenFor(1, "root"), "POST", {
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
    const response = await request("/partner-contracts", await tokenFor(5, "member"), "POST", {
      partner_id: 1,
      title: "Blocked",
      contract_date: "2026-02-01",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown partner", async () => {
    const response = await request("/partner-contracts", await tokenFor(1, "root"), "POST", {
      partner_id: 9999,
      title: "Ghost",
      contract_date: "2026-02-01",
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /partner-contracts/:id", () => {
  test("updates a contract as admin", async () => {
    const response = await request("/partner-contracts/1", await tokenFor(1, "root"), "PUT", {
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
    const response = await request("/partner-contracts/1", await tokenFor(5, "member"), "PUT", {
      title: "Hijacked",
      contract_date: "2026-01-15",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for unknown id", async () => {
    const response = await request("/partner-contracts/9999", await tokenFor(1, "root"), "PUT", {
      title: "Missing",
      contract_date: "2026-01-15",
    })

    expect(response.status).toBe(404)
  })
})
