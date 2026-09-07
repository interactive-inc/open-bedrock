import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zRingiProcedureView } from "@/contexts/ringi/interface/http/response-schemas"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedRingiRequests } from "@/contexts/ringi/test/seed/seed-ringi-requests.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "ringi-route-test-secret"

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
    "ringi_requests",
    seedRingiRequests.map((ringi) => ({
      id: ringi.id,
      applicant_id: ringi.applicantId,
      approver_id: ringi.approverId,
      title: ringi.title,
      amount: ringi.amount,
      reason: ringi.reason,
      status: ringi.status,
      decided_at: ringi.decidedAt,
      decision_comment: ringi.decisionComment,
      created_at: ringi.createdAt,
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

type RequestProps = {
  path: string
  token: string | null
  method?: string
  body?: unknown
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("既存稟議の参照と承認経路の切替", () => {
  test("未認証の提出と参照を拒否する", async () => {
    expect(
      (
        await request({
          path: "/ringi/ringi-requests",
          token: null,
          method: "POST",
          body: {
            request_key: crypto.randomUUID(),
            approver_id: "4",
            title: "Request",
            amount: 500,
            reason: "Reason",
          },
        })
      ).status,
    ).toBe(401)
    for (const path of ["me", "inbox", "admin", "1"])
      expect((await request({ path: `/ringi/ringi-requests/${path}`, token: null })).status).toBe(
        401,
      )
  })

  test("再送キーなしの旧提出を受け付けない", async () => {
    expect(
      (
        await request({
          path: "/ringi/ringi-requests",
          token: await tokenFor(5),
          method: "POST",
          body: { approver_id: "4", title: "Request", amount: 500, reason: "Reason" },
        })
      ).status,
    ).toBe(400)
  })

  test("本人一覧は既存の番号・決裁結果を保全し、他人の稟議を含まない", async () => {
    const response = await request({ path: "/ringi/ringi-requests/me", token: await tokenFor(5) })
    expect(response.status).toBe(200)
    const rows = z
      .object({ data: z.array(zRingiProcedureView), total: z.number() })
      .parse(await response.json())
    expect(rows.total).toBe(2)
    expect(rows.data.map((row) => row.id)).toEqual([2, 1])
    expect(rows.data.find((row) => row.id === 2)?.status).toBe("approved")
    expect(rows.data.find((row) => row.id === 1)?.procedure_required).toBe(true)
  })

  test("全社閲覧権限と本人の範囲を別に検査する", async () => {
    expect(
      (await request({ path: "/ringi/ringi-requests/admin", token: await tokenFor(5) })).status,
    ).toBe(403)
    const response = await request({
      path: "/ringi/ringi-requests/admin?status=pending&limit=1",
      token: await tokenFor(1),
    })
    expect(response.status).toBe(200)
    const result = z
      .object({ data: z.array(zRingiProcedureView), total: z.number() })
      .parse(await response.json())
    expect(result.total).toBe(2)
    expect(result.data).toHaveLength(1)
  })

  test("保存された提出先や管理権限だけで旧稟議を決裁できない", async () => {
    expect(
      (await request({ path: "/ringi/ringi-requests/1", token: await tokenFor(4) })).status,
    ).toBe(403)
    for (const action of ["approve", "reject"])
      expect(
        (
          await request({
            path: `/ringi/ringi-requests/1/${action}`,
            token: await tokenFor(1),
            method: "POST",
            body: {
              decision_target: {
                proposal_version: 1,
                proposal_digest: "0".repeat(64),
                task_key: "legacy",
                task_round: 1,
              },
              comment: null,
            },
          })
        ).status,
      ).toBe(409)
  })

  test("受信箱に未提出の旧稟議を承認対象として混ぜない", async () => {
    expect(
      (await request({ path: "/ringi/ringi-requests/inbox", token: await tokenFor(4) })).status,
    ).toBe(403)
    const response = await request({
      path: "/ringi/ringi-requests/inbox",
      token: await tokenFor(1),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [], next_offset: null })
  })
})
