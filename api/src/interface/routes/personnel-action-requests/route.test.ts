import { createTestToken } from "@/interface/test-helpers/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@/interface/test-helpers/lifecycle-route-fixture"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
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
  await db
    .prepare(
      `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
       SELECT 1, id, 1, 0 FROM roles WHERE key = 'hr'`,
    )
    .run()
  await db
    .prepare(
      `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
       SELECT 6, id, 1, 0 FROM roles WHERE key = 'hr'`,
    )
    .run()
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
      base_organization_revision: 0,
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
      current_step: "hr_approval",
    })
    expect(
      await db.prepare("SELECT COUNT(*) FROM personnel_actions").first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM application_subjects
           WHERE application_id = ?1 AND subject_employee_id = 5`,
        )
        .bind(applicationId)
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM application_workflow_step_candidates
           WHERE application_id = ?1 AND candidate_employee_id = 1`,
        )
        .bind(applicationId)
        .first<number>("COUNT(*)"),
    ).toBe(1)
  })

  test("applies the action atomically when final approval succeeds", async () => {
    const db = await prepareDb()
    const { applicationId } = await createRequest(db)

    const approved = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/applications/${applicationId}/approve`,
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
        .prepare("SELECT revision FROM employee_lifecycle_revisions WHERE employee_id = 5")
        .first<number>("revision"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM org_assignment_period_versions
           WHERE employee_id = 5 AND position_title = 'Senior Engineer'`,
        )
        .first<number>("COUNT(*)"),
    ).toBe(1)
  })

  test("rolls back the approval when lifecycle revisions are stale", async () => {
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
      path: `/applications/${applicationId}/approve`,
      method: "POST",
      token: await token(1),
      body: { comment: null },
      now: "2026-01-02T00:00:00.000Z",
    })

    expect(response.status).toBe(409)
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM application_workflow_approvals WHERE application_id = ?1")
        .bind(applicationId)
        .first<number>("COUNT(*)"),
    ).toBe(0)
    expect(
      await db
        .prepare("SELECT status FROM applications WHERE id = ?1")
        .bind(applicationId)
        .first<string>("status"),
    ).toBe("pending")
    expect(
      await db.prepare("SELECT COUNT(*) FROM personnel_actions").first<number>("COUNT(*)"),
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
      positionTitle: "Senior Engineer",
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
        .prepare("SELECT status FROM applications WHERE id = ?1")
        .bind(applicationId)
        .first<string>("status"),
    ).toBe("rejected")
    expect(
      await db.prepare("SELECT COUNT(*) FROM personnel_actions").first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare("SELECT action FROM audit_logs ORDER BY id DESC LIMIT 1")
        .first<string>("action"),
    ).toBe("employee.lifecycle.request_withdrawn")
  })

  test("rejects without applying lifecycle facts", async () => {
    const db = await prepareDb()
    const { applicationId } = await createRequest(db)
    const rejected = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/applications/${applicationId}/reject`,
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
        base_organization_revision: 0,
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
          `SELECT subject_type, subject_employee_id FROM application_subjects
           WHERE application_id = ?1`,
        )
        .bind(body.application_id)
        .first<{ subject_type: string; subject_employee_id: number | null }>(),
    ).toEqual({ subject_type: "prospective_employee", subject_employee_id: null })

    const approved = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/applications/${body.application_id}/approve`,
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
    // positionCode "ENGINEER" は発令の assignment に解決後のマスタ名 "Engineer" で保存される。
    expect(
      await db
        .prepare(
          `SELECT position_title FROM org_assignment_period_versions
           WHERE employee_id = ?1 AND is_void = 0 ORDER BY revision DESC LIMIT 1`,
        )
        .bind(employeeId)
        .first<string>("position_title"),
    ).toBe("Engineer")
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
        base_organization_revision: 0,
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
