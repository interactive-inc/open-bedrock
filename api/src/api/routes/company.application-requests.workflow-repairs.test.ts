import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { RetireEmployee } from "@/contexts/company/application/employee-lifecycle/retire-employee"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { createTestToken } from "@tests/api/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@tests/api/support/lifecycle-route-fixture"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { createTestContextForDatabase } from "@tests/api/support/create-test-context"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { describe, expect, test } from "bun:test"

const now = "2026-01-01T00:00:00.000Z"

/** 申請者。fixture 上で D003 に属し、上長として employee 4 を持つ。 */
const applicantEmployeeId = 5

/** 申請者名。バッチ解決した Map から申請者を引けているかの検証に使う。 */
const applicantName = "Emery Lane"

/**
 * 凍結される承認候補の全員。
 * 組織責務を持たない2名を明示候補にし、正規の退職発令で到達不能にする。
 * 承認モードは any（requiredApprovals = 1）なので、片方だけ retired にしても
 * もう片方が在籍のまま残り reachable >= requiredApprovals が成立して検出されない。
 * 修復対象を作るには候補を全員 retired にする必要がある。
 */
const approverEmployees = [
  { id: 6, code: "E006" },
  { id: 10, code: "E010" },
] as const

/**
 * workflow 監査と template 管理の両権限を持つ閲覧者。
 * seed で root ロールを持つ employee 1 は承認候補から分離し、検査中も在籍を保つ。
 */
const inspectorEmployeeId = 1

type TestState = Readonly<{
  db: D1Database
  resetQueries: () => void
  queries: () => number
}>

function token(employeeId: number): Promise<string> {
  return createTestToken(lifecycleRouteJwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
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
          approvers: approverEmployees.map((employee) => ({
            type: "employee" as const,
            employee_code: employee.code,
          })),
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
    path: "/company/application-requests",
    method: "POST",
    body: { template_code: "workflow_repair_test_request", payload: { reason } },
    token: await token(applicantEmployeeId),
    now,
  })
  expect(response.status).toBe(201)
}

/**
 * pending 案件を count 件だけ作り、承認候補を正規の退職発令で修復対象へ落とす。
 * 候補は task 生成時に System 側へ凍結されるため、提出後の retire は
 * workflow の行を壊さずに「在籍者数 < 必要承認数」だけを成立させる。
 */
async function seedBrokenProposals(state: TestState, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await submit(state.db, `Repair candidate ${index + 1}`)
  }

  for (const employee of approverEmployees) {
    const employeeRevision = await state.db
      .prepare("SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1")
      .bind(String(employee.id))
      .first<number>("revision")
    const organizationRevision = await state.db
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")
    if (employeeRevision === null || organizationRevision === null) {
      throw new Error("canonical Company revisions are missing")
    }

    const retired = await new RetireEmployee(createTestContextForDatabase(state.db)).execute({
      session: {
        accountId: zAccountId.parse(String(inspectorEmployeeId)),
        employeeId: toWorkforceEmployeeId(inspectorEmployeeId),
        hasPermission: (permission) => permission === "employee:lifecycle:apply",
      },
      employeeId: toWorkforceEmployeeId(employee.id),
      input: {
        kind: "retired",
        employeeCode: employee.code,
        retirementOn: restoreCalendarDate("2025-12-31"),
      },
      idempotencyKey: `workflow-repair-retirement-${employee.id}`,
      expectedEmployeeRevision: employeeRevision,
      expectedOrganizationRevision: organizationRevision,
    })
    if (retired instanceof CompanyOperationError) throw retired
  }
}

async function listRepairs(state: TestState): Promise<Response> {
  return requestWithContext({
    db: state.db,
    jwtSecret: lifecycleRouteJwtSecret,
    path: "/company/application-requests/workflow-repairs",
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
