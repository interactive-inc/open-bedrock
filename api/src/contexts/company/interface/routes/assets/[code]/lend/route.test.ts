import { describe, expect, test } from "bun:test"
import { seedAssetLendings } from "@/infrastructure/seed/seed-asset-lendings"
import { seedAssets } from "@/infrastructure/seed/seed-assets"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "asset-lend-route-test-secret"

const assetResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchased_on: z.string().nullable(),
  status: z.string(),
  holder_employee_id: z.number().nullable(),
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
    role: "root",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
    method,
    body,
  })
}

describe("POST /assets/:code/lend", () => {
  test("privileged role lends an in_stock asset and returns 200", async () => {
    const response = await request("/assets/A0003/lend", await adminToken(), "POST", {
      employee_code: "E005",
    })

    expect(response.status).toBe(200)

    const parsed = assetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("lent")
      expect(parsed.data.holder_employee_id).toBe(5)
    }
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await request("/assets/A0003/lend", await adminToken(), "POST", {
      employee_code: "E999",
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the asset is already lent", async () => {
    const response = await request("/assets/A0001/lend", await adminToken(), "POST", {
      employee_code: "E009",
    })

    expect(response.status).toBe(409)
  })

  test("member is forbidden", async () => {
    const response = await request("/assets/A0003/lend", await memberToken(), "POST", {
      employee_code: "E009",
    })

    expect(response.status).toBe(403)
  })

  test("returns 400 when employee_code is missing", async () => {
    const response = await request("/assets/A0003/lend", await adminToken(), "POST", {})

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/assets/A0003/lend", null, "POST", {
      employee_code: "E005",
    })

    expect(response.status).toBe(401)
  })
})
