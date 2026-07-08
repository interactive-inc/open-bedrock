import { describe, expect, test } from "bun:test"
import { seedAssetLendings } from "@/infrastructure/seed/seed-asset-lendings"
import { seedAssets } from "@/infrastructure/seed/seed-assets"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "asset-holdings-route-test-secret"

const holdingSchema = z.object({
  asset_code: z.string(),
  asset_name: z.string(),
  kind: z.string(),
  holder_employee_id: z.number(),
  holder_employee_code: z.string(),
  holder_employee_name: z.string(),
  lent_at: z.string().nullable(),
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
    "assets",
    seedAssets.map((asset) => ({
      code: asset.code,
      name: asset.name,
      kind: asset.kind,
      serial: asset.serial,
      purchased_on: asset.purchasedOn,
      status: asset.status,
      holder_employee_id: asset.holderEmployeeId,
      disposed_on: asset.disposedOn,
      disposal_reason: asset.disposalReason,
    })),
  )

  await seedD1(
    db,
    "asset_lendings",
    seedAssetLendings.map((lending) => ({
      id: lending.id,
      asset_code: lending.assetCode,
      employee_id: lending.employeeId,
      lent_at: lending.lentAt,
      returned_at: lending.returnedAt,
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

describe("GET /assets/holdings", () => {
  test("lists lent assets with holder and lent_at for a privileged role", async () => {
    const response = await request("/assets/holdings", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(holdingSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // seed の lent は A0001(E005) と A0002(E009) の 2 件。
      expect(parsed.data.total).toBe(2)

      const first = parsed.data.data.find((row) => row.asset_code === "A0001")

      expect(first?.holder_employee_id).toBe(5)
      expect(first?.lent_at).toBe("2026-04-01T09:00:00Z")
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/assets/holdings", await memberToken())

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/assets/holdings", null)

    expect(response.status).toBe(401)
  })
})
