import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { HTTPException } from "hono/http-exception"
import { DELETE, PUT } from "@/contexts/company/interface/routes/assets/[code]/route"
import { databaseMiddleware } from "@/contexts/company/interface/middlewares/database-middleware"
import type { Bindings } from "@/env"
import { factory } from "@/contexts/company/interface/utils/factory"
import { seedAssetLendings } from "@/contexts/company/infrastructure/seed/seed-asset-lendings"
import { seedAssets } from "@/contexts/company/infrastructure/seed/seed-assets"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { z } from "zod"

const jwtSecret = "asset-crud-route-test-secret"

const assetResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchased_on: z.string().nullable(),
  status: z.string(),
  holder_employee_id: z.number().nullable(),
})

/** app.ts と同じ登録（:code）でハンドラを載せたローカル app。app.ts は他エージェントと共有のため触れない。 */
const localApp = factory
  .createApp()
  .use("*", contextStorage())
  .use("*", databaseMiddleware)
  .onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status)
    }

    return c.json({ error: "internal server error" }, 500)
  })
  .put("/assets/:code", ...PUT)
  .delete("/assets/:code", ...DELETE)

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
  token: string,
  method: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }

  if (body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const bindings: Bindings = {
    DB: await createTestDb(),
    JWT_SECRET: jwtSecret,
    AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
    NOW: "2026-01-01T00:00:00.000Z",
  }

  return localApp.request(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    bindings,
  )
}

describe("PUT /assets/:code", () => {
  test("privileged role updates asset details and returns 200", async () => {
    const response = await request("/assets/A0003", await adminToken(), "PUT", {
      name: "Updated Notebook",
      kind: "monitor",
      serial: "SN-NEW",
      purchased_on: "2026-01-01",
    })

    expect(response.status).toBe(200)

    const parsed = assetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Updated Notebook")
      expect(parsed.data.kind).toBe("monitor")
      expect(parsed.data.serial).toBe("SN-NEW")
      expect(parsed.data.status).toBe("in_stock")
    }
  })

  test("returns 403 for a non-privileged role", async () => {
    const response = await request("/assets/A0003", await memberToken(), "PUT", {
      name: "Hijacked",
      kind: "pc",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing asset", async () => {
    const response = await request("/assets/A9999", await adminToken(), "PUT", {
      name: "Ghost",
      kind: "pc",
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /assets/:code", () => {
  test("privileged role deletes an in_stock asset and returns 204", async () => {
    const response = await request("/assets/A0003", await adminToken(), "DELETE")

    expect(response.status).toBe(204)
  })

  test("returns 409 when the asset is currently lent", async () => {
    const response = await request("/assets/A0001", await adminToken(), "DELETE")

    expect(response.status).toBe(409)
  })

  test("returns 403 for a non-privileged role", async () => {
    const response = await request("/assets/A0003", await memberToken(), "DELETE")

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing asset", async () => {
    const response = await request("/assets/A9999", await adminToken(), "DELETE")

    expect(response.status).toBe(404)
  })
})
