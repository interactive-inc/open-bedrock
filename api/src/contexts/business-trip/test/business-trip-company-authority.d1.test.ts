import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import { BusinessTripRepository } from "@/contexts/business-trip/infrastructure/repositories/business-trip.repository"
import { seedBusinessTrips } from "@/contexts/business-trip/test/seed/seed-business-trips.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1, applyMigrations, startLocalD1 } from "@tests/d1/support/start-local-d1"

const jwtSecret = "business-trip-company-authority-test-secret"

// E002 の出張。E001 は直属上司、E099 は技術的権限を持つが E002 の管理系列に属さない。
const tripId = "10000000-0000-0000-0000-000000000001"
const manager = 1
const unrelatedManagerWithPermission = 99

const actions = ["approve", "reject"] as const
const cases = ["authorized", "unrelated", "unresolvable", "changed"] as const

let local: LocalD1

// 独立したローカルD1へ全migrationを適用するため、1件あたり数秒かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1(actions.flatMap((action) => cases.map((kind) => `${action}-${kind}`)))
})

afterAll(async () => {
  await local.dispose()
})

/** cycle を指定すると E001 と E002 が互いの上長となり、管理系列を一意に評価できない。 */
async function createTestDb(name: string, cycle = false): Promise<D1Database> {
  const db = await local.database(name)

  await applyMigrations(db)
  await initializeStandardCompanyTestState(db, {
    memberships: cycle
      ? [{ departmentCode: "D001", employeeCode: "E001", managerEmployeeCode: "E002" }]
      : [],
  })
  await seedIamForEmployees(db, [
    { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "hr" },
  ])
  await seedD1(
    db,
    "business_trips",
    seedBusinessTrips.map((businessTrip) => ({
      id: businessTrip.id,
      traveler_id: businessTrip.travelerId,
      destination: businessTrip.destination,
      start_date: businessTrip.startDate,
      end_date: businessTrip.endDate,
      purpose: businessTrip.purpose,
      estimated_cost: businessTrip.estimatedCost,
      status: businessTrip.status,
      created_at: businessTrip.createdAt,
    })),
  )

  return db
}

async function decide(
  db: D1Database,
  action: (typeof actions)[number],
  employeeId: number,
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: `/business-trip/business-trips/${tripId}/${action}`,
    token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(employeeId) }),
    method: "POST",
  })
}

async function errorCode(response: Response): Promise<string | undefined> {
  return z.object({ code: z.string().optional() }).parse(await response.json()).code
}

function storedStatus(db: D1Database): Promise<string | null> {
  return db
    .prepare("SELECT status FROM business_trips WHERE id = ?1")
    .bind(tripId)
    .first<string>("status")
}

describe("business trip decisions compose technical permission with Company authority", () => {
  for (const action of actions) {
    const decided = action === "approve" ? "approved" : "rejected"

    test(`${action}: 申請者の管理系列にいる判断者は判断できる`, async () => {
      const db = await createTestDb(`${action}-authorized`)

      const response = await decide(db, action, manager)

      expect(response.status).toBe(200)
      expect(await storedStatus(db)).toBe(decided)
    })

    test(`${action}: 技術的権限だけでは会社上の資格を補えない`, async () => {
      const db = await createTestDb(`${action}-unrelated`)

      const response = await decide(db, action, unrelatedManagerWithPermission)

      expect(response.status).toBe(403)
      expect(await errorCode(response)).toBe("company_authority_required")
      expect(await storedStatus(db)).toBe("requested")
    })

    test(`${action}: 会社上の資格を評価できなければ拒否する`, async () => {
      const db = await createTestDb(`${action}-unresolvable`, true)

      const response = await decide(db, action, manager)

      expect(response.status).toBe(403)
      expect(await errorCode(response)).toBe("company_authority_unavailable")
      expect(await storedStatus(db)).toBe("requested")
    })

    test(`${action}: 資格の参照後に会社の状態が変われば保存しない`, async () => {
      const db = await createTestDb(`${action}-changed`)
      const save = BusinessTripRepository.prototype.updateStatus
      const interception = spyOn(
        BusinessTripRepository.prototype,
        "updateStatus",
      ).mockImplementationOnce(async function (this: BusinessTripRepository, props) {
        await db
          .prepare(
            "UPDATE company_organization_lifecycle_states SET revision = revision + 1 WHERE id = 1",
          )
          .run()
        return save.call(this, props)
      })

      try {
        const response = await decide(db, action, manager)

        expect(response.status).toBe(409)
        expect(await errorCode(response)).toBe("company_authority_changed")
        expect(await storedStatus(db)).toBe("requested")
      } finally {
        interception.mockRestore()
      }
    })
  }
})
