import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
  readOrganizationRevision,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { describe, expect, test } from "bun:test"

const action = {
  kind: "position_changed",
  employeeCode: "E005",
  eventOn: "2026-02-01",
  departmentCode: "D003",
  assignmentType: "primary",
  positionCode: "SENIOR_ENGINEER",
  changeType: "promotion",
} as const

async function token(employeeId: number) {
  return createTestToken(lifecycleRouteJwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
  })
}

async function prepareDb(): Promise<D1Database> {
  const db = await createLifecycleRouteDb()
  // roleはAPI操作能力だけを付与する。候補資格はfixtureのCompany責務から解決する。
  for (const accountId of [1, 6]) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         SELECT 'test:personnel-action:' || ?1 || ':' || role.id,
                ?1, role.id, NULL, NULL, 0, NULL
         FROM system_iam_roles AS role WHERE role.key = 'company:hr'`,
      )
      .bind(String(accountId))
      .run()
  }
  return db
}

async function createRequest(db: D1Database): Promise<{
  response: Response
  applicationId: number
}> {
  const response = await requestWithContext({
    db,
    jwtSecret: lifecycleRouteJwtSecret,
    path: "/personnel-action-requests",
    method: "POST",
    token: await token(4),
    body: {
      action,
      base_employee_revision: 0,
      base_organization_revision: await readOrganizationRevision(db),
    },
    now: "2026-01-01T00:00:00.000Z",
  })
  const body = (await response.clone().json()) as { application_id: number }
  return { response, applicationId: body.application_id }
}

describe("POST /personnel-action-requests", () => {
  test("creates a frozen approval request without applying the action", async () => {
    const db = await prepareDb()
    const { response, applicationId } = await createRequest(db)

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      application_id: applicationId,
      target_employee_code: "E005",
      kind: "position_changed",
      status: "pending",
      current_step: "people_operations_approval",
    })
    expect(
      await db.prepare("SELECT COUNT(*) FROM personnel_actions").first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM personnel_action_requests
           WHERE application_id = ?1 AND target_employee_id = 5
             AND system_proposal_series_id IS NOT NULL`,
        )
        .bind(applicationId)
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*)
           FROM system_decision_task_candidates candidate
           JOIN system_proposal_cases proposal_case ON proposal_case.case_id = candidate.case_id
           JOIN system_proposals proposal ON proposal.id = proposal_case.proposal_id
           JOIN system_proposal_numbers number ON number.series_id = proposal.series_id
           WHERE number.number = ?1 AND candidate.candidate_account_id = '1'`,
        )
        .bind(applicationId)
        .first<number>("COUNT(*)"),
    ).toBe(1)
  })

  test("cancels the System procedure when the Company association cannot be stored", async () => {
    const db = await prepareDb()
    await db.exec(`
      CREATE TRIGGER reject_personnel_action_request
      BEFORE INSERT ON personnel_action_requests
      BEGIN
        SELECT RAISE(ABORT, 'Company association unavailable');
      END;
    `)

    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-action-requests",
      method: "POST",
      token: await token(4),
      body: {
        action,
        base_employee_revision: 0,
        base_organization_revision: await readOrganizationRevision(db),
      },
      now: "2026-01-01T00:00:00.000Z",
    })

    expect(response.status).toBe(500)
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM personnel_action_requests")
        .first<number>("total"),
    ).toBe(0)
    expect(
      await db
        .prepare("SELECT status FROM system_cases ORDER BY created_at DESC LIMIT 1")
        .first<string>("status"),
    ).toBe("cancelled")
  })

  test("applies the action atomically when final approval succeeds", async () => {
    const db = await prepareDb()
    const { applicationId } = await createRequest(db)

    const approved = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/application-requests/${applicationId}/approve`,
      method: "POST",
      token: await token(1),
      body: { comment: "approved" },
      now: "2026-01-02T00:00:00.000Z",
    })

    expect(approved.status).toBe(200)
    expect(await approved.json()).toEqual({ status: "approved" })
    const applied = await db
      .prepare(
        `SELECT action.source_type, action.source_application_id, request.applied_action_id
         FROM personnel_action_requests request
         INNER JOIN personnel_actions action ON action.id = request.applied_action_id
         WHERE request.application_id = ?1`,
      )
      .bind(applicationId)
      .first<{
        source_type: string
        source_application_id: number
        applied_action_id: string
      }>()
    expect(applied).toMatchObject({
      source_type: "application",
      source_application_id: applicationId,
    })
    expect(applied?.applied_action_id).toBeTruthy()
    expect(
      await db
        .prepare(
          `SELECT workflow_case.status
           FROM system_cases workflow_case
           JOIN system_proposal_cases proposal_case ON proposal_case.case_id = workflow_case.id
           JOIN system_proposals proposal ON proposal.id = proposal_case.proposal_id
           JOIN system_proposal_numbers number ON number.series_id = proposal.series_id
           WHERE number.number = ?1`,
        )
        .bind(applicationId)
        .first<string>("status"),
    ).toBe("executed")
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM system_execution_authorizations authorization
           JOIN system_proposal_cases proposal_case ON proposal_case.case_id = authorization.case_id
           JOIN system_proposals proposal ON proposal.id = proposal_case.proposal_id
           JOIN system_proposal_numbers number ON number.series_id = proposal.series_id
           WHERE number.number = ?1 AND authorization.used_at IS NOT NULL`,
        )
        .bind(applicationId)
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare("SELECT revision FROM employee_lifecycle_revisions WHERE employee_id = 5")
        .first<number>("revision"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM employee_org_assignment_period_versions
           WHERE employee_id = 5 AND position_title = 'シニアエンジニア'`,
        )
        .first<number>("COUNT(*)"),
    ).toBe(1)
  })

  test("keeps a stale approved action unexecuted and safely retries completion", async () => {
    const db = await prepareDb()
    const { applicationId } = await createRequest(db)
    await db
      .prepare(
        `INSERT INTO employee_lifecycle_revisions (employee_id, revision, updated_at)
         VALUES (5, 1, 1)
         ON CONFLICT(employee_id) DO UPDATE SET revision = 1`,
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/application-requests/${applicationId}/approve`,
      method: "POST",
      token: await token(1),
      body: { comment: null },
      now: "2026-01-02T00:00:00.000Z",
    })

    expect(response.status).toBe(409)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM system_human_attestations attestation
           JOIN system_proposal_cases proposal_case ON proposal_case.case_id = attestation.case_id
           JOIN system_proposals proposal ON proposal.id = proposal_case.proposal_id
           JOIN system_proposal_numbers number ON number.series_id = proposal.series_id
           WHERE number.number = ?1`,
        )
        .bind(applicationId)
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT workflow_case.status
           FROM system_cases workflow_case
           JOIN system_proposal_cases proposal_case ON proposal_case.case_id = workflow_case.id
           JOIN system_proposals proposal ON proposal.id = proposal_case.proposal_id
           JOIN system_proposal_numbers number ON number.series_id = proposal.series_id
           WHERE number.number = ?1`,
        )
        .bind(applicationId)
        .first<string>("status"),
    ).toBe("approved")
    expect(
      await db.prepare("SELECT COUNT(*) FROM personnel_actions").first<number>("COUNT(*)"),
    ).toBe(1)
    await db
      .prepare("UPDATE employee_lifecycle_revisions SET revision = 0 WHERE employee_id = 5")
      .run()
    const retried = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/application-requests/${applicationId}/approve`,
      method: "POST",
      token: await token(1),
      body: { comment: null },
      now: "2026-01-02T00:01:00.000Z",
    })
    expect(retried.status).toBe(200)
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM personnel_actions WHERE source_application_id = ?1")
        .bind(applicationId)
        .first<number>("COUNT(*)"),
    ).toBe(1)
  })

  test("exposes requests only to frozen participants and read-all roles", async () => {
    const db = await prepareDb()
    const { applicationId } = await createRequest(db)
    const id = await db
      .prepare("SELECT id FROM personnel_action_requests WHERE application_id = ?1")
      .bind(applicationId)
      .first<string>("id")
    if (id === null) throw new Error("request was not created")

    const requesterList = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-action-requests?target_employee_code=E005&status=pending",
      token: await token(4),
    })
    expect(requesterList.status).toBe(200)
    expect(await requesterList.json()).toMatchObject({
      requests: [{ id, application_id: applicationId, status: "pending" }],
    })

    const candidateDetail = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/personnel-action-requests/${id}`,
      token: await token(1),
    })
    expect(candidateDetail.status).toBe(200)
    // 保存されるのは役職 code をマスタ名へ解決したドメイン入力（positionTitle）。
    const resolvedAction = {
      kind: "position_changed",
      employeeCode: "E005",
      eventOn: "2026-02-01",
      departmentCode: "D003",
      assignmentType: "primary",
      positionTitle: "シニアエンジニア",
      changeType: "promotion",
    }
    expect(await candidateDetail.json()).toMatchObject({
      id,
      action: resolvedAction,
      requested_by_employee_code: "E004",
    })

    const outsider = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/personnel-action-requests/${id}`,
      token: await token(5),
    })
    expect(outsider.status).toBe(404)
  })

  test("lets only the requester withdraw and never creates lifecycle facts", async () => {
    const db = await prepareDb()
    const { applicationId } = await createRequest(db)
    const id = await db
      .prepare("SELECT id FROM personnel_action_requests WHERE application_id = ?1")
      .bind(applicationId)
      .first<string>("id")
    if (id === null) throw new Error("request was not created")

    const forbidden = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/personnel-action-requests/${id}`,
      method: "DELETE",
      token: await token(1),
    })
    expect(forbidden.status).toBe(403)

    const withdrawn = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/personnel-action-requests/${id}`,
      method: "DELETE",
      token: await token(4),
      now: "2026-01-02T00:00:00.000Z",
    })
    expect(withdrawn.status).toBe(200)
    expect(await withdrawn.json()).toEqual({ status: "withdrawn" })
    expect(
      await db
        .prepare(
          `SELECT workflow_case.status
           FROM system_cases workflow_case
           JOIN system_proposal_cases proposal_case ON proposal_case.case_id = workflow_case.id
           JOIN system_proposals proposal ON proposal.id = proposal_case.proposal_id
           JOIN system_proposal_numbers number ON number.series_id = proposal.series_id
           WHERE number.number = ?1`,
        )
        .bind(applicationId)
        .first<string>("status"),
    ).toBe("cancelled")
    expect(
      await db.prepare("SELECT COUNT(*) FROM personnel_actions").first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare("SELECT action FROM audit_events ORDER BY id DESC LIMIT 1")
        .first<string>("action"),
    ).toBe("employee.lifecycle.request_withdrawn")
  })

  test("rejects without applying lifecycle facts", async () => {
    const db = await prepareDb()
    const { applicationId } = await createRequest(db)
    const rejected = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/application-requests/${applicationId}/reject`,
      method: "POST",
      token: await token(1),
      body: { comment: "not approved" },
    })
    expect(rejected.status).toBe(200)
    expect(await rejected.json()).toEqual({ status: "rejected" })
    expect(
      await db.prepare("SELECT COUNT(*) FROM personnel_actions").first<number>("COUNT(*)"),
    ).toBe(1)
  })

  test("keeps a hire prospective until approval then creates the employee atomically", async () => {
    const db = await prepareDb()
    const hire = {
      kind: "hire",
      employeeCode: "E777",
      employeeName: "Future Teammate",
      eventOn: "2026-02-01",
      departmentCode: "D003",
      positionCode: "ENGINEER",
      managerEmployeeCode: "E004",
    } as const
    const requested = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-action-requests",
      method: "POST",
      token: await token(4),
      body: {
        action: hire,
        base_employee_revision: 0,
        base_organization_revision: await readOrganizationRevision(db),
      },
    })
    expect(requested.status).toBe(201)
    const body = (await requested.json()) as { application_id: number }
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM employees WHERE code = 'E777'")
        .first<number>("COUNT(*)"),
    ).toBe(0)
    expect(
      await db
        .prepare(
          `SELECT target_employee_id,
                  json_extract(subject_snapshot_json, '$.employeeCode') AS employee_code
           FROM personnel_action_requests WHERE application_id = ?1`,
        )
        .bind(body.application_id)
        .first<{ target_employee_id: number | null; employee_code: string }>(),
    ).toEqual({ target_employee_id: null, employee_code: "E777" })

    const approved = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/application-requests/${body.application_id}/approve`,
      method: "POST",
      token: await token(6),
      body: { comment: null },
      now: "2026-01-02T00:00:00.000Z",
    })
    expect(approved.status).toBe(200)
    const employeeId = await db
      .prepare("SELECT id FROM employees WHERE code = 'E777'")
      .first<number>("id")
    expect(employeeId).not.toBeNull()
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM personnel_actions
           WHERE employee_id = ?1 AND kind = 'hire' AND source_application_id = ?2`,
        )
        .bind(employeeId, body.application_id)
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          "SELECT target_employee_id FROM personnel_action_requests WHERE application_id = ?1",
        )
        .bind(body.application_id)
        .first<number>("target_employee_id"),
    ).toBe(employeeId)
    // positionCode "ENGINEER" は発令の assignment に解決後のマスタ名 "エンジニア" で保存される。
    expect(
      await db
        .prepare(
          `SELECT position_title FROM employee_org_assignment_period_versions
           WHERE employee_id = ?1 AND is_void = 0 ORDER BY revision DESC LIMIT 1`,
        )
        .bind(employeeId)
        .first<string>("position_title"),
    ).toBe("エンジニア")
  })

  test("rejects a hire that sets a position without a department with 422", async () => {
    const db = await prepareDb()
    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-action-requests",
      method: "POST",
      token: await token(4),
      body: {
        action: {
          kind: "hire",
          employeeCode: "E778",
          employeeName: "No Department Teammate",
          eventOn: "2026-02-01",
          departmentCode: null,
          positionCode: "ENGINEER",
          managerEmployeeCode: null,
        },
        base_employee_revision: 0,
        base_organization_revision: await readOrganizationRevision(db),
      },
    })
    expect(response.status).toBe(422)
    const body = (await response.json()) as { code?: string }
    expect(body.code).toBe("position_requires_department")
    // 拒否されたので hire の発令も申請の対象従業員も作られない。
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'hire'")
        .first<number>("count"),
    ).toBe(0)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM employees WHERE code = 'E778'")
        .first<number>("count"),
    ).toBe(0)
  })
})
