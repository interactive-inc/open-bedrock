import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-redemption.repository"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

const jwtSecret = "thanks-redemption-company-authority-test-secret"

// E002 の交換申請。E001 は直属上司、E099 は技術的権限を持つが E002 の管理系列に属さない。
const redemptionId = "0190002b-0000-7000-8000-000000000001"
const rewardId = "0190002a-0000-7000-8000-000000000001"
const manager = 1
const unrelatedManagerWithPermission = 99

const actions = ["approve", "reject"] as const
const cases = ["authorized", "unrelated", "unresolvable", "changed"] as const

let local: LocalD1

// 独立したローカルD1へ全migrationを適用するため、1件あたり数秒かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: actions.flatMap((action) => cases.map((kind) => `${action}-${kind}`)),
  })
})

afterAll(async () => {
  await local.dispose()
})

/** cycle を指定すると E001 と E002 が互いの上長となり、管理系列を一意に評価できない。 */
async function createTestDb(name: string, cycle = false): Promise<D1Database> {
  const db = await local.database(name)

  await initializeStandardCompanyTestState(db, {
    memberships: cycle
      ? [{ departmentCode: "D001", employeeCode: "E001", managerEmployeeCode: "E002" }]
      : [],
  })
  await seedIamForEmployees(db, [
    { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "hr" },
  ])
  await seedD1(db, "thanks_messages", [
    {
      id: "01900028-0000-7000-8000-000000000001",
      sender_employee_id: "3",
      recipient_employee_id: "2",
      message: "Thank you",
      points: 100,
      created_at: "2025-12-01T00:00:00.000Z",
    },
  ])
  await seedD1(db, "thanks_rewards", [
    {
      id: rewardId,
      name: "Reward",
      point_cost: 50,
      is_active: 1,
      stock: 3,
      created_at: "2025-12-01T00:00:00.000Z",
    },
  ])
  await seedD1(db, "thanks_redemptions", [
    {
      id: redemptionId,
      employee_id: "2",
      reward_id: rewardId,
      point_cost: 50,
      status: "pending",
      created_at: "2025-12-02T00:00:00.000Z",
      decided_at: null,
      decider_id: null,
    },
  ])

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
    path: `/thanks/thanks-redemptions/${redemptionId}/${action}`,
    token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(employeeId) }),
    method: "POST",
  })
}

async function errorCode(response: Response): Promise<string | undefined> {
  return z.object({ code: z.string().optional() }).parse(await response.json()).code
}

async function persisted(db: D1Database) {
  return {
    redemption: await db
      .prepare("SELECT status, decider_id FROM thanks_redemptions WHERE id = ?1")
      .bind(redemptionId)
      .first(),
    stock: await db
      .prepare("SELECT stock FROM thanks_rewards WHERE id = ?1")
      .bind(rewardId)
      .first<number>("stock"),
  }
}

const untouched = { redemption: { status: "pending", decider_id: null }, stock: 3 }

describe("thanks redemption decisions compose technical permission with Company authority", () => {
  for (const action of actions) {
    test(`${action}: 申請者の管理系列にいる判断者は判断できる`, async () => {
      const db = await createTestDb(`${action}-authorized`)

      const response = await decide(db, action, manager)

      expect(response.status).toBe(200)
      expect(await persisted(db)).toEqual(
        action === "approve"
          ? { redemption: { status: "fulfilled", decider_id: "1" }, stock: 2 }
          : { redemption: { status: "rejected", decider_id: "1" }, stock: 3 },
      )
    })

    test(`${action}: 技術的権限だけでは会社上の資格を補えない`, async () => {
      const db = await createTestDb(`${action}-unrelated`)

      const response = await decide(db, action, unrelatedManagerWithPermission)

      expect(response.status).toBe(403)
      expect(await errorCode(response)).toBe("company_authority_required")
      expect(await persisted(db)).toEqual(untouched)
    })

    test(`${action}: 会社上の資格を評価できなければ拒否する`, async () => {
      const db = await createTestDb(`${action}-unresolvable`, true)

      const response = await decide(db, action, manager)

      expect(response.status).toBe(403)
      expect(await errorCode(response)).toBe("company_authority_unavailable")
      expect(await persisted(db)).toEqual(untouched)
    })

    test(`${action}: 資格の参照後に会社の状態が変われば保存しない`, async () => {
      const db = await createTestDb(`${action}-changed`)
      const mutateCompany = () =>
        db
          .prepare(
            "UPDATE company_organization_lifecycle_states SET revision = revision + 1 WHERE id = 1",
          )
          .run()
      const approve = ThanksRedemptionRepository.prototype.approveFromPending
      const reject = ThanksRedemptionRepository.prototype.rejectFromPending
      const interception =
        action === "approve"
          ? spyOn(
              ThanksRedemptionRepository.prototype,
              "approveFromPending",
            ).mockImplementationOnce(async function (this: ThanksRedemptionRepository, props) {
              await mutateCompany()
              return approve.call(this, props)
            })
          : spyOn(ThanksRedemptionRepository.prototype, "rejectFromPending").mockImplementationOnce(
              async function (this: ThanksRedemptionRepository, props) {
                await mutateCompany()
                return reject.call(this, props)
              },
            )

      try {
        const response = await decide(db, action, manager)

        expect(response.status).toBe(409)
        expect(await errorCode(response)).toBe("company_authority_changed")
        expect(await persisted(db)).toEqual(untouched)
      } finally {
        interception.mockRestore()
      }
    })
  }
})
