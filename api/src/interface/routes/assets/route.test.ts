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

const jwtSecret = "asset-list-route-test-secret"

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

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: employeeId === 1 ? "root" : "member",
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

describe("GET /assets", () => {
  test("asset:manage holder reads sensitive fields for every asset", async () => {
    const response = await request("/assets", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(assetResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(6)
      expect(parsed.data.data.find((asset) => asset.code === "A0002")).toMatchObject({
        serial: "CN-D27-0002",
        purchased_on: "2024-04-01",
        holder_employee_id: 9,
      })
    }
  })

  test("current holder reads sensitive fields only for their own held asset", async () => {
    const response = await request("/assets", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(assetResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(parsed.data.find((asset) => asset.code === "A0001")).toMatchObject({
      serial: "PF-X1-0001",
      purchased_on: "2024-04-01",
      holder_employee_id: 5,
    })
    expect(parsed.data.find((asset) => asset.code === "A0002")).toMatchObject({
      serial: null,
      purchased_on: null,
      holder_employee_id: null,
    })
    expect(parsed.data.find((asset) => asset.code === "A0003")).toMatchObject({
      serial: null,
      purchased_on: null,
      holder_employee_id: null,
    })
  })

  test("unrelated member receives only catalog fields", async () => {
    const response = await request("/assets", await tokenFor(6))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(assetResponseSchema), total: z.number() })
      .parse(await response.json())
    const asset = parsed.data.find((candidate) => candidate.code === "A0001")

    expect(asset).toMatchObject({
      code: "A0001",
      name: "標準ノートPC 14インチ",
      kind: "pc",
      status: "lent",
      serial: null,
      purchased_on: null,
      holder_employee_id: null,
    })
  })

  test("filters by kind", async () => {
    const response = await request("/assets?kind=pc", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(assetResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
      expect(parsed.data.data.every((asset) => asset.kind === "pc")).toBe(true)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/assets", null)

    expect(response.status).toBe(401)
  })
})
