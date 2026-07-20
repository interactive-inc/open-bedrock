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

const jwtSecret = "asset-register-route-test-secret"

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

describe("POST /assets", () => {
  test("privileged role creates an asset and returns 201", async () => {
    const response = await request("/assets", await adminToken(), "POST", {
      code: "A0099",
      name: "New Laptop",
      kind: "pc",
    })

    expect(response.status).toBe(201)

    const parsed = assetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("in_stock")
      expect(parsed.data.holder_employee_id).toBeNull()
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/assets", await memberToken(), "POST", {
      code: "A0099",
      name: "New Laptop",
      kind: "pc",
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code returns 409", async () => {
    const response = await request("/assets", await adminToken(), "POST", {
      code: "A0001",
      name: "Duplicate",
      kind: "pc",
    })

    expect(response.status).toBe(409)
  })

  test("returns 400 for an invalid kind", async () => {
    const response = await request("/assets", await adminToken(), "POST", {
      code: "A0098",
      name: "X",
      kind: "bogus",
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/assets", null, "POST", {
      code: "A0097",
      name: "X",
      kind: "pc",
    })

    expect(response.status).toBe(401)
  })
})
