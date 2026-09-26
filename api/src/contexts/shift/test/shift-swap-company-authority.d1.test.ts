import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import { ShiftSwapRequestRepository } from "@/contexts/shift/infrastructure/repositories/shift-swap-request.repository"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

const jwtSecret = "shift-swap-company-authority-test-secret"

// E005（上長 E004）と E010（上長 E009）の交代。E001 は両者の管理系列の上位にいる。
// E004 は E005 だけを管理し、E099 は技術的権限を持つがどちらの管理系列にも属さない。
const swapRequestId = "01900025-0000-7000-8000-000000000001"
const manager = 1
const managerOfOneParty = 4
const unrelatedManagerWithPermission = 99

const cases = ["authorized", "partial", "unrelated", "unresolvable", "changed"] as const

let local: LocalD1

// 独立したローカルD1へ全migrationを適用するため、1件あたり数秒かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: cases })
})

afterAll(async () => {
  await local.dispose()
})

/** cycle を指定すると E001 と E009 が互いの上長となり、管理系列を一意に評価できない。 */
async function createTestDb(name: string, cycle = false): Promise<D1Database> {
  const db = await local.database(name)

  await initializeStandardCompanyTestState(db, {
    memberships: cycle
      ? [{ departmentCode: "D001", employeeCode: "E001", managerEmployeeCode: "E009" }]
      : [],
  })
  await seedIamForEmployees(db, [
    { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "hr" },
  ])
  await seedD1(db, "shift_patterns", [
    {
      id: "01900023-0000-7000-8000-000000000001",
      code: "EARLY",
      name: "Early",
      start_time: "09:00",
      end_time: "18:00",
      break_minutes: 60,
    },
    {
      id: "01900023-0000-7000-8000-000000000002",
      code: "LATE",
      name: "Late",
      start_time: "13:00",
      end_time: "22:00",
      break_minutes: 60,
    },
  ])
  await seedD1(db, "shift_assignments", [
    {
      id: "01900024-0000-7000-8000-000000000001",
      employee_id: testEmployeeId(5),
      pattern_id: "01900023-0000-7000-8000-000000000001",
      date: "2026-06-01",
      note: null,
      published_at: null,
    },
    {
      id: "01900024-0000-7000-8000-000000000002",
      employee_id: testEmployeeId(10),
      pattern_id: "01900023-0000-7000-8000-000000000002",
      date: "2026-06-01",
      note: null,
      published_at: null,
    },
  ])
  await seedD1(db, "shift_swap_requests", [
    {
      id: swapRequestId,
      requester_employee_id: testEmployeeId(5),
      target_employee_id: testEmployeeId(10),
      date: "2026-06-01",
      note: null,
      status: "pending",
      approved_at: null,
    },
  ])

  return db
}

async function approve(db: D1Database, employeeId: number): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: `/shift/shift-swap-requests/${swapRequestId}/approve`,
    token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(employeeId) }),
    method: "POST",
  })
}

async function errorCode(response: Response): Promise<string | undefined> {
  return z.object({ code: z.string().optional() }).parse(await response.json()).code
}

async function persisted(db: D1Database) {
  const request = await db
    .prepare("SELECT status FROM shift_swap_requests WHERE id = ?1")
    .bind(swapRequestId)
    .first<string>("status")
  const assignments = await db
    .prepare("SELECT employee_id, pattern_id FROM shift_assignments ORDER BY id")
    .all()
  return { request, assignments: assignments.results }
}

const untouched = {
  request: "pending",
  assignments: [
    { employee_id: testEmployeeId(5), pattern_id: "01900023-0000-7000-8000-000000000001" },
    { employee_id: testEmployeeId(10), pattern_id: "01900023-0000-7000-8000-000000000002" },
  ],
}

describe("shift swap approval composes technical permission with Company authority", () => {
  test("両当事者の管理系列にいる判断者は承認でき、割当を入れ替える", async () => {
    const db = await createTestDb("authorized")

    const response = await approve(db, manager)

    expect(response.status).toBe(200)
    expect(await persisted(db)).toEqual({
      request: "approved",
      assignments: [
        { employee_id: testEmployeeId(5), pattern_id: "01900023-0000-7000-8000-000000000002" },
        { employee_id: testEmployeeId(10), pattern_id: "01900023-0000-7000-8000-000000000001" },
      ],
    })
  })

  test("一方の当事者だけを管理する判断者は承認できない", async () => {
    const db = await createTestDb("partial")

    const response = await approve(db, managerOfOneParty)

    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe("company_authority_required")
    expect(await persisted(db)).toEqual(untouched)
  })

  test("技術的権限だけでは会社上の資格を補えない", async () => {
    const db = await createTestDb("unrelated")

    const response = await approve(db, unrelatedManagerWithPermission)

    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe("company_authority_required")
    expect(await persisted(db)).toEqual(untouched)
  })

  test("会社上の資格を評価できなければ拒否する", async () => {
    const db = await createTestDb("unresolvable", true)

    const response = await approve(db, manager)

    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe("company_authority_unavailable")
    expect(await persisted(db)).toEqual(untouched)
  })

  test("資格の参照後に会社の状態が変われば入れ替えない", async () => {
    const db = await createTestDb("changed")
    const save = ShiftSwapRequestRepository.prototype.approveWithAssignmentSwap
    const interception = spyOn(
      ShiftSwapRequestRepository.prototype,
      "approveWithAssignmentSwap",
    ).mockImplementationOnce(async function (this: ShiftSwapRequestRepository, props) {
      await db
        .prepare(
          "UPDATE company_organization_lifecycle_states SET revision = revision + 1 WHERE id = 1",
        )
        .run()
      return save.call(this, props)
    })

    try {
      const response = await approve(db, manager)

      expect(response.status).toBe(409)
      expect(await errorCode(response)).toBe("company_authority_changed")
      expect(await persisted(db)).toEqual(untouched)
    } finally {
      interception.mockRestore()
    }
  })
})
