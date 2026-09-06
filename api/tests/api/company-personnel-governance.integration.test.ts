import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"
import { lifecycleSha256 } from "@/contexts/company/domain/definitions/lifecycle-sha256.definition"
import { stableLifecycleJson } from "@/contexts/company/domain/definitions/stable-lifecycle-json.definition"
import { withCurrentDecisionTarget } from "@tests/api/support/with-current-decision-target"
import { describe, expect, spyOn, test } from "bun:test"
import { z } from "zod"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { CompleteApprovedPersonnelActionRequest } from "@/contexts/company/application/employee-lifecycle/procedure/complete-approved-personnel-action-request"
import { PersonnelActionPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-persistence.adapter"
import { CompanyConflictError } from "@/contexts/company/domain/errors"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"

async function createFixture() {
  const c = await createGovernanceTaskTestContext()
  const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
  const target = c.people[1]
  if (assignment === undefined || target === undefined)
    throw new Error("personnel fixture is missing")
  const employees = await new D1CompanyResourceRepository(c.database).findMany({
    organizationId: "organization:default",
    types: ["employee"],
    effectiveOn: assignment.effectiveFrom,
  })
  if (!employees.ok) throw new Error("employee resources are missing")
  await c.write([
    ...employees.resources.map((employee) => ({
      organizationId: employee.organizationId,
      type: employee.type,
      id: employee.id,
      state: employee.state,
      effectiveFrom: employee.effectiveFrom,
      effectiveTo: employee.effectiveTo,
      revision: employee.revision + 1,
      attributes: {
        ...employee.attributes,
        employeeCode: `MEMBER-${c.people.findIndex((person) => person.employeeId === employee.id)}`,
      },
    })),
    {
      ...assignment,
      revision: 2,
      attributes: { ...assignment.attributes, authorityScopeId: null },
    },
  ])
  await c.database
    .exec(`INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
    VALUES ('personnel-requester', 'custom:personnel-requester', 'custom', NULL, 'Personnel requester', 0, 0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
    VALUES ('personnel-requester', 'employee:lifecycle:request'), ('personnel-requester', 'employee:lifecycle:read:all');`)
  await c.database
    .prepare(`INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
    VALUES ('personnel-requester-binding', ?1, 'personnel-requester', NULL, NULL, 0, NULL)`)
    .bind(c.creator.accountId)
    .run()
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: {
      version: 1,
      steps: [
        {
          ...c.step,
          governance_authority: {
            organization_id: "organization:default",
            responsibility_code: "APPROVE",
            scope: null,
          },
        },
      ],
    },
  })
  if (policy instanceof Error) throw policy
  const procedure = ProcedureDefinitionEntity.create({
    key: "personnel_action_request",
    revision: 1,
    title: "Personnel request",
    category: "company",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "company.personnel-action.apply",
    createdByAccountId: c.creator.accountId,
    createdAt: c.at,
  })
  if (procedure instanceof Error) throw procedure
  const published = await new SystemD1ProcedureRepository({ env: { DB: c.database } }).publish(
    procedure,
    0,
  )
  if (published !== true) throw published
  const request = async (index: number, path: string, body: unknown, key?: string) => {
    const person = c.people[index]
    if (person === undefined) throw new Error("person is missing")
    return requestWithContext({
      db: c.database,
      jwtSecret: "personnel-governance-test",
      path,
      body: await withCurrentDecisionTarget(c.database, path, body),
      method: "POST",
      now: c.at.toISOString(),
      headers: key === undefined ? {} : { "Idempotency-Key": key },
      token: await createTestToken("personnel-governance-test", {
        employeeId: person.employeeId,
        accountId: person.accountId,
      }),
    })
  }
  const revision = await c.database
    .prepare("SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1")
    .bind(target.employeeId)
    .first<number>("revision")
  if (revision === null) throw new Error("employee revision is missing")
  const input = {
    action: { kind: "leave_started", employeeCode: "MEMBER-1", eventOn: assignment.effectiveFrom },
    base_employee_revision: revision,
    base_organization_revision: null,
  }
  const idempotencyKey = crypto.randomUUID()
  const submit = () => request(0, "/company/personnel-action-requests", input, idempotencyKey)
  const withdrawAuthority = () =>
    c.write([
      {
        ...assignment,
        revision: 3,
        state: "void",
        attributes: { ...assignment.attributes, authorityScopeId: null },
      },
    ])
  return { ...c, target, input, idempotencyKey, request, submit, withdrawAuthority }
}

describe("Company公開責務による人事発令", () => {
  test("区分を含まない旧提案は本文を改変せず承認前に409で止める", async () => {
    const c = await createFixture()
    const action = {
      kind: "hire",
      employeeCode: "LEGACY",
      employeeName: "Legacy Applicant",
      eventOn: c.at.toISOString().slice(0, 10),
    }
    const resolved = await new ResolveCompanyGovernanceTaskAdapter(c.context).resolve({
      step: {
        ...c.step,
        governance_authority: {
          organization_id: "organization:default",
          responsibility_code: "APPROVE",
          scope: null,
        },
      },
      payload: action,
      subjectEmployeeId: null,
      excludedEmployeeIds: new Set([c.creator.employeeId]),
      openedAt: c.at,
      dueAt: null,
      resolvedAt: c.at,
    })
    if (resolved instanceof Error) throw resolved
    const id = crypto.randomUUID()
    const started = await new StartSystemProcedure({
      writer: new SystemD1WorkflowAdapter(c.context),
    }).run({
      seriesId: crypto.randomUUID(),
      version: 1,
      procedureKey: "personnel_action_request",
      procedureRevision: 1,
      body: action,
      createdByAccountId: c.creator.accountId,
      supersedesProposalId: null,
      createdAt: c.at,
      firstTask: resolved.task,
      subject: { context: "company", kind: "personnel-action-request", id, version: "1" },
    })
    if (started instanceof Error) throw started
    const fingerprint = await lifecycleSha256(
      stableLifecycleJson({ employeeId: "prospective:LEGACY", input: action }),
    )
    await c.database
      .prepare(`INSERT INTO company_personnel_action_requests
      (id, application_id, system_proposal_series_id, target_employee_id, subject_snapshot_json, target_department_code, kind, payload_json, payload_fingerprint, requested_by_employee_id, base_employee_revision, base_organization_revision, created_at, applied_action_id)
      VALUES (?1, ?2, ?3, NULL, ?4, NULL, 'hire', ?5, ?6, ?7, 0, NULL, ?8, NULL)`)
      .bind(
        id,
        started.number,
        started.proposal.seriesId,
        JSON.stringify({ employeeCode: action.employeeCode, employeeName: action.employeeName }),
        started.proposal.bodyJson,
        fingerprint,
        c.creator.employeeId,
        Math.floor(c.at.getTime() / 1000),
      )
      .run()
    const response = await c.request(2, `/company/application-requests/${started.number}/approve`, {
      comment: null,
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "personnel_action_contract_required" })
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(0)
    expect(
      await c.database
        .prepare("SELECT payload_json FROM company_personnel_action_requests WHERE id = ?1")
        .bind(id)
        .first<string>("payload_json"),
    ).toBe(started.proposal.bodyJson)
  })

  test("承認した入社の雇用区分を一回だけ実行する", async () => {
    const c = await createFixture()
    const input = {
      action: {
        kind: "hire",
        employeeCode: "NEW-PT",
        employeeName: "New Part Time Employee",
        employmentType: "PART_TIME",
        eventOn: c.at.toISOString().slice(0, 10),
      },
      base_employee_revision: 0,
      base_organization_revision: null,
    }
    const submitted = await c.request(
      0,
      "/company/personnel-action-requests",
      input,
      crypto.randomUUID(),
    )
    expect(submitted.status).toBe(201)
    const number = z
      .object({ application_id: z.number() })
      .parse(await submitted.json()).application_id
    for (const index of [2, 3, 3])
      expect(
        (
          await c.request(index, `/company/application-requests/${number}/approve`, {
            comment: null,
          })
        ).status,
      ).toBe(200)
    const employee = await c.database
      .prepare("SELECT id FROM company_employees WHERE employee_code = 'NEW-PT'")
      .first<{ id: string }>()
    if (employee === null) throw new Error("employee was not created")
    expect(
      await c.database
        .prepare("SELECT employment_type FROM company_employments WHERE employee_id = ?1")
        .bind(employee.id)
        .all(),
    ).toMatchObject({ results: [{ employment_type: "PART_TIME" }] })
    expect(
      await c.database
        .prepare(
          "SELECT json_extract(attributes_json, '$.employmentType') AS employment_type FROM company_resource_revisions WHERE resource_type = 'employment' AND json_extract(attributes_json, '$.employeeId') = ?1",
        )
        .bind(employee.id)
        .all(),
    ).toMatchObject({ results: [{ employment_type: "PART_TIME" }] })
  })

  test("雇用区分のない入社・再入社・訂正の依頼を保存しない", async () => {
    const c = await createFixture()
    for (const action of [
      { kind: "hire", employeeCode: "NEW", employeeName: "New Employee", eventOn: "2026-01-01" },
      { kind: "rehire", employeeCode: "MEMBER-1", eventOn: "2026-01-01" },
      {
        kind: "corrected",
        correctsActionId: crypto.randomUUID(),
        reason: "Correction",
        eventOn: "2026-01-01",
        replacementAction: { kind: "rehire", employeeCode: "MEMBER-1", eventOn: "2026-01-01" },
      },
    ])
      expect(
        (
          await c.request(
            0,
            "/company/personnel-action-requests",
            { ...c.input, action },
            crypto.randomUUID(),
          )
        ).status,
      ).toBe(400)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_personnel_action_requests")
        .first<number>("total"),
    ).toBe(0)
  })

  test.each(["authority", "account"])(
    "資格確認後の変更でも発令・実行許可を原子的に取り消す: %s",
    async (change) => {
      const c = await createFixture()
      const number = z
        .object({ application_id: z.number() })
        .parse(await (await c.submit()).json()).application_id
      expect(
        (await c.request(2, `/company/application-requests/${number}/approve`, { comment: null }))
          .status,
      ).toBe(200)
      const interception = spyOn(
        PersonnelActionPersistenceAdapter.prototype,
        "executeAuthorized",
      ).mockImplementationOnce(async function (this: PersonnelActionPersistenceAdapter, command) {
        interception.mockRestore()
        if (change === "authority") await c.withdrawAuthority()
        else
          await c.database
            .prepare(
              "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1 WHERE id = ?1",
            )
            .bind(c.people[2]?.accountId)
            .run()
        return this.executeAuthorized(command)
      })
      try {
        expect(
          (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
            .status,
        ).toBe(409)
      } finally {
        interception.mockRestore()
      }
      expect(
        await c.database.prepare("SELECT status FROM system_cases").first<string>("status"),
      ).toBe("approved")
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM system_human_attestations")
          .first<number>("total"),
      ).toBe(2)
      expect(
        await c.database
          .prepare(
            "SELECT count(*) AS total FROM company_personnel_actions WHERE source_application_id = ?1",
          )
          .bind(number)
          .first<number>("total"),
      ).toBe(0)
      expect(
        await c.database
          .prepare("SELECT status FROM company_employments WHERE employee_id = ?1")
          .bind(c.target.employeeId)
          .first<string>("status"),
      ).toBe("ACTIVE")
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
          .first<number>("total"),
      ).toBe(0)
    },
  )

  test("承認済みでも閲覧者は発令できず、有効な承認者の再試行だけが一回確定する", async () => {
    const c = await createFixture()
    const number = z
      .object({ application_id: z.number() })
      .parse(await (await c.submit()).json()).application_id
    expect(
      (await c.request(2, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
    const interception = spyOn(
      CompleteApprovedPersonnelActionRequest.prototype,
      "run",
    ).mockResolvedValueOnce(new CompanyConflictError("retry execution", "personnel_action_stale"))
    try {
      expect(
        (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
          .status,
      ).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(
      (await c.request(0, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(403)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
        .first<number>("total"),
    ).toBe(0)
    expect(
      (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM company_personnel_actions WHERE source_application_id = ?1",
        )
        .bind(number)
        .first<number>("total"),
    ).toBe(1)
  })

  test("保存失敗をHTTP成功として隠さず、公開履歴と実行許可も残さず再試行できる", async () => {
    const c = await createFixture()
    const number = z
      .object({ application_id: z.number() })
      .parse(await (await c.submit()).json()).application_id
    expect(
      (await c.request(2, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
    const revisions = await c.database
      .prepare("SELECT count(*) AS total FROM company_resource_revisions")
      .first<number>("total")
    await c.database.exec(
      "CREATE TRIGGER fail_execution_receipt BEFORE UPDATE OF applied_action_id ON company_personnel_action_requests BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END;",
    )
    expect(
      (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(500)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<number>("total"),
    ).toBe(revisions)
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM company_personnel_actions WHERE source_application_id = ?1",
        )
        .bind(number)
        .first<number>("total"),
    ).toBe(0)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
        .first<number>("total"),
    ).toBe(0)
    await c.database.exec("DROP TRIGGER fail_execution_receipt")
    expect(
      (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
  })

  test("先に承認した人のAccountが発令前に失効すると必要人数を満たさない", async () => {
    const c = await createFixture()
    const number = z
      .object({ application_id: z.number() })
      .parse(await (await c.submit()).json()).application_id
    expect(
      (await c.request(2, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
    const interception = spyOn(
      CompleteApprovedPersonnelActionRequest.prototype,
      "run",
    ).mockImplementationOnce(
      async function (this: CompleteApprovedPersonnelActionRequest, command) {
        interception.mockRestore()
        await c.database
          .prepare(
            "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1 WHERE id = ?1",
          )
          .bind(c.people[2]?.accountId)
          .run()
        return this.run(command)
      },
    )
    try {
      expect(
        (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
          .status,
      ).toBe(403)
    } finally {
      interception.mockRestore()
    }
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
        .first<number>("total"),
    ).toBe(0)
  })

  test("申請者と対象者を除外し、二名の承認から公開雇用と業務台帳を一回だけ更新する", async () => {
    const c = await createFixture()
    const submitted = await c.submit()
    expect({ status: submitted.status, body: await submitted.clone().json() }).toMatchObject({
      status: 201,
    })
    const number = z
      .object({ application_id: z.number() })
      .parse(await submitted.json()).application_id
    expect(
      (await c.request(1, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(403)
    expect(
      (await c.request(2, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
    const completed = await c.request(3, `/company/application-requests/${number}/approve`, {
      comment: null,
    })
    expect({ status: completed.status, body: await completed.clone().json() }).toMatchObject({
      status: 200,
    })
    expect(
      await c.database.prepare("SELECT status FROM system_cases").first<string>("status"),
    ).toBe("executed")
    expect(
      await c.database
        .prepare("SELECT status FROM company_employments WHERE employee_id = ?1")
        .bind(c.target.employeeId)
        .first<string>("status"),
    ).toBe("ON_LEAVE")
    expect(
      await c.database
        .prepare(
          "SELECT json_extract(attributes_json, '$.status') AS status FROM company_resource_heads WHERE resource_type = 'employment' AND json_extract(attributes_json, '$.employeeId') = ?1",
        )
        .bind(c.target.employeeId)
        .first<string>("status"),
    ).toBe("ON_LEAVE")
    expect((await c.submit()).status).toBe(200)
    expect(
      (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM company_personnel_actions WHERE source_application_id = ?1",
        )
        .bind(number)
        .first<number>("total"),
    ).toBe(1)
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM system_execution_authorizations WHERE used_at IS NOT NULL",
        )
        .first<number>("total"),
    ).toBe(1)
  })

  test("承認確定と実行の間に責務が取り消された場合は発令しない", async () => {
    const c = await createFixture()
    const submitted = await c.submit()
    const number = z
      .object({ application_id: z.number() })
      .parse(await submitted.json()).application_id
    expect(
      (await c.request(2, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
    const interception = spyOn(
      CompleteApprovedPersonnelActionRequest.prototype,
      "run",
    ).mockImplementationOnce(
      async function (this: CompleteApprovedPersonnelActionRequest, command) {
        interception.mockRestore()
        await c.withdrawAuthority()
        return this.run(command)
      },
    )
    try {
      expect(
        (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
          .status,
      ).toBe(403)
    } finally {
      interception.mockRestore()
    }
    expect(
      await c.database
        .prepare("SELECT status FROM company_employments WHERE employee_id = ?1")
        .bind(c.target.employeeId)
        .first<string>("status"),
    ).toBe("ACTIVE")
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
        .first<number>("total"),
    ).toBe(0)
  })
})
