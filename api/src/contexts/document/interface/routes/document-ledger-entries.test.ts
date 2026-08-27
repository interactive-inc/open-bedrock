import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedDocuments } from "@/contexts/document/test/seed/seed-documents.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "document-route-test-secret"

const listItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string().nullable(),
  location: z.string(),
  partner_code: z.string().nullable(),
  expires_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

const listSchema = z.object({
  data: z.array(listItemSchema),
  total: z.number(),
})

const documentSchema = listItemSchema

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
    "document_ledger_entries",
    seedDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      category: document.category,
      location: document.location,
      partner_code: document.partnerCode,
      expires_on: document.expiresOn,
      note: document.note,
      created_at: document.createdAt,
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

describe("GET /document-ledger-entries", () => {
  test("admin (document:read:all) gets the list sorted by nearest expiry, nulls last", async () => {
    const response = await request("/document-ledger-entries", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
      // 2026-09-30 (id 2) < 2027-03-31 (id 1) < null (id 3)
      expect(parsed.data.data[0]?.id).toBe(2)
      expect(parsed.data.data[1]?.id).toBe(1)
      expect(parsed.data.data[2]?.id).toBe(3)
    }
  })

  test("member without document:read:all is forbidden", async () => {
    const response = await request("/document-ledger-entries", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("filters by category", async () => {
    const response = await request("/document-ledger-entries?category=license", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.id).toBe(2)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/document-ledger-entries", null)

    expect(response.status).toBe(401)
  })
})

describe("POST /document-ledger-entries", () => {
  test("admin registers a document", async () => {
    const response = await request("/document-ledger-entries", await tokenFor(1), "POST", {
      title: "NDA Template",
      location: "cabinet-C/nda",
      expires_on: "2028-01-01",
    })

    expect(response.status).toBe(201)

    const parsed = documentSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("NDA Template")
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/document-ledger-entries", await tokenFor(5), "POST", {
      title: "Blocked",
      location: "nowhere",
    })

    expect(response.status).toBe(403)
  })
})

describe("PUT /document-ledger-entries/:id", () => {
  test("admin updates a document", async () => {
    const response = await request("/document-ledger-entries/1", await tokenFor(1), "PUT", {
      title: "Office Lease Agreement (renewed)",
      location: "cabinet-A/lease",
      partner_code: "P0001",
      expires_on: "2030-03-31",
    })

    expect(response.status).toBe(200)

    const parsed = documentSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("Office Lease Agreement (renewed)")
      expect(parsed.data.expires_on).toBe("2030-03-31")
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/document-ledger-entries/1", await tokenFor(5), "PUT", {
      title: "x",
      location: "y",
    })

    expect(response.status).toBe(403)
  })
})
