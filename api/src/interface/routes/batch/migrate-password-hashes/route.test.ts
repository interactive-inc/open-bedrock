import { describe, expect, test } from "bun:test"
import { toLegacyPasswordHash } from "@/lib/auth/to-legacy-password-hash"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"

const jwtSecret = "migrate-password-hashes-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  const legacyHash = await toLegacyPasswordHash("password")
  const modernHash = await toPasswordHash("password")

  await seedD1(db, "employees", [
    {
      id: 1,
      code: "E001",
      name: "Admin User",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
    {
      id: 2,
      code: "E002",
      name: "Legacy User",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
  ])

  // 移行対象は identities.secret。E002 にレガシー secret を持たせる。
  await seedIamForEmployees(db, [
    { id: 1, email: "you+admin@example.com", passwordHash: modernHash, role: "admin" },
    { id: 2, email: "you+legacy@example.com", passwordHash: legacyHash, role: "member" },
  ])

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+admin@example.com",
    role: "admin",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 2,
    email: "you+legacy@example.com",
    role: "member",
  })
}

describe("POST /batch/migrate-password-hashes", () => {
  test("migrates legacy hashes and returns counts", async () => {
    const db = await createTestDb()
    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/batch/migrate-password-hashes",
      token,
      method: "POST",
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      total: number
      migrated: number
      skipped: number
      failed: number
    }

    expect(body.total).toBe(1)
    expect(body.migrated).toBe(1)
    expect(body.skipped).toBe(0)
    expect(body.failed).toBe(0)
  })

  test("returns 401 without a bearer token", async () => {
    const db = await createTestDb()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/batch/migrate-password-hashes",
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })

  test("returns 403 for a non-privileged role", async () => {
    const db = await createTestDb()
    const token = await memberToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/batch/migrate-password-hashes",
      token,
      method: "POST",
    })

    expect(response.status).toBe(403)
  })
})
