import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/organization/company-procedure-decision-policy"
import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { zAccountId } from "@system/domain/values/account-id.schema"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/workflow/system-d1-procedure.repository"
import { describe, expect, test } from "bun:test"

const now = "2026-01-01T00:00:00.000Z"

/** 申請者。fixture 上で employee 4 を management chain の承認者に持つ。 */
const applicantEmployeeId = 5

/** 申請者名。バッチ解決した Map から申請者を引けているかの検証に使う。 */
const applicantName = "Emery Lane"

/** 凍結された承認候補。提出後に retired へ落として修復対象を作る。 */
const approverEmployeeId = 4

/** workflow 監査と template 管理の両権限を持つ閲覧者。 */
const inspectorEmployeeId = 1

type TestState = Readonly<{
  db: D1Database
  resetQueries: () => void
  queries: () => number
}>

function token(employeeId: number): Promise<string> {
  return createTestToken(lifecycleRouteJwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
  })
}

async function createTestState(): Promise<TestState> {
  let queryCount = 0
  const db = await createLifecycleRouteDb({ onQuery: () => (queryCount += 1) })
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: {
      version: 1,
      steps: [
        {
          key: "manager_approval",
          name: "Manager approval",
          approvers: [{ type: "management_chain" }],
          approval_mode: "any",
          condition_mode: "all",
          conditions: [],
          due_days: null,
          escalation_approvers: [],
          rejection_behavior: "reject",
          allow_delegation: true,
        },
      ],
    },
  })
  if (policy instanceof Error) throw policy

  const definition = ProcedureDefinitionEntity.create({
    key: "workflow_repair_test_request",
    revision: 1,
    title: "Workflow repair test request",
    category: "test",
    description: "Exercises workflow repair detection over many pending proposals.",
    inputSchema: {
      fields: [
        {
          id: "reason",
          label: "Reason",
          type: "text",
          required: true,
          description: null,
          options: null,
        },
      ],
    },
    decisionPolicy: policy,
    completionOperationKey: null,
    createdByAccountId: zAccountId.parse("1"),
    createdAt: new Date(now),
  })
  if (definition instanceof Error) throw definition

  const published = await new SystemD1ProcedureRepository({ env: { DB: db } }).publish(
    definition,
    0,
  )
  if (published !== true) throw published

  return {
    db,
    resetQueries: () => (queryCount = 0),
    queries: () => queryCount,
  }
}

async function submit(db: D1Database, reason: string): Promise<void> {
  const response = await requestWithContext({
    db,
    jwtSecret: lifecycleRouteJwtSecret,
    path: "/application-requests",
    method: "POST",
    body: { template_code: "workflow_repair_test_request", payload: { reason } },
    token: await token(applicantEmployeeId),
    now,
  })
  expect(response.status).toBe(201)
}

/**
 * pending 案件を count 件だけ作り、承認候補を全員 retired にして修復対象へ落とす。
 * 候補は task 生成時に System 側へ凍結されるため、提出後の retire は
 * workflow の行を壊さずに「在籍者数 < 必要承認数」だけを成立させる。
 */
async function seedBrokenProposals(state: TestState, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await submit(state.db, `Repair candidate ${index + 1}`)
  }

  await state.db
    .prepare("UPDATE employees SET status = 'retired' WHERE id = ?1")
    .bind(approverEmployeeId)
    .run()
}

async function listRepairs(state: TestState): Promise<Response> {
  return requestWithContext({
    db: state.db,
    jwtSecret: lifecycleRouteJwtSecret,
    path: "/application-requests/workflow-repairs",
    token: await token(inspectorEmployeeId),
    now,
  })
}

/** 案件 count 件を検出したときに GET が発行したクエリ数を測る。 */
async function measureQueries(count: number): Promise<number> {
  const state = await createTestState()
  await seedBrokenProposals(state, count)
  state.resetQueries()

  const response = await listRepairs(state)
  const queries = state.queries()
  const body = await response.json()

  expect(response.status).toBe(200)
  expect(body).toMatchObject({ total: count })

  return queries
}

describe("GET /application-requests/workflow-repairs", () => {
  test("detects every stalled proposal and names its applicant", async () => {
    const state = await createTestState()
    await seedBrokenProposals(state, 3)

    const response = await listRepairs(state)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ total: 3 })
    if (typeof body !== "object" || body === null || !("data" in body)) {
      throw new Error("workflow repair list is missing")
    }
    expect(body.data).toHaveLength(3)
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          template_code: "workflow_repair_test_request",
          template_name: "Workflow repair test request",
          applicant_name: applicantName,
          step_key: "manager_approval",
          round: 1,
          reason: "inactive_candidates",
        }),
      ]),
    )
  }, 30_000)

  test("keeps candidate resolution off the per-proposal path", async () => {
    const twoProposals = await measureQueries(2)
    const sixProposals = await measureQueries(6)

    // 案件 1 件あたりの増分。System 側に一括版が無い listTasks と
    // listTaskCandidateAccountIds の 2 本だけが案件数に比例してよい。
    // 参加者解決を案件ごとに呼ぶ旧実装ではこの傾きが 4 になる。
    const queriesPerProposal = (sixProposals - twoProposals) / 4

    expect(queriesPerProposal).toBe(2)
  }, 30_000)
})
