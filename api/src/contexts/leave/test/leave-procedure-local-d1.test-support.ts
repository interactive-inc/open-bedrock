import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { ApplyExternalIdentities } from "@/contexts/company/application/external-identities/apply-external-identities"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { ExternalIdentityImportRepository } from "@/contexts/company/infrastructure/repositories/external-identities/external-identity-import.repository"
import { resolveCompanyGovernanceTask } from "@/contexts/company/interface/operations/resolve-company-governance-task"
import { CompleteApprovedLeaveProcedure } from "@/contexts/leave/application/complete-approved-leave-procedure"
import { CompleteRejectedLeaveProcedure } from "@/contexts/leave/application/complete-rejected-leave-procedure"
import { RecordLeaveDecision } from "@/contexts/leave/application/record-leave-decision"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { LeaveProcedureRepository } from "@/contexts/leave/infrastructure/repositories/leave-procedure.repository"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { createSystemDecisionTask } from "@system/domain/policies/decision-task.policy"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { createProposalId } from "@system/domain/schemas/workflow/proposal-id.schema"
import { createSystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { createTestContextForDatabase } from "@tests/api/support/create-context-for-database"
import type { LocalD1 } from "@tests/d1/support/start-local-d1"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.machine-sessions"
import { drizzle } from "drizzle-orm/d1"

async function runAll(database: D1Database, statements: ReadonlyArray<string>): Promise<void> {
  await database.batch(statements.map((statement) => database.prepare(statement)))
}

/**
 * migration済みのローカルD1へ、公開Companyの入社登録と合議体の責務規程を作成する。
 * Company側のfixtureと同じ手順を、互換ラッパーを使わずに組み立てる。
 */
async function createGovernance(database: D1Database) {
  const now = new Date()
  const accountId = zAccountId.parse("external-import-service")
  const credentialId = "external-import-credential"
  const hash = await new SystemPrincipalSecretService().hashRawSecret("1".repeat(64))
  if (hash instanceof Error) throw hash
  await runAll(database, [
    `INSERT INTO company_organizations (id, revision, name, representative_name, created_at, updated_at)
      SELECT 'organization:default', 0, 'Example organization', 'Example representative', 0, 0
      WHERE NOT EXISTS (SELECT 1 FROM company_organizations WHERE id = 'organization:default')`,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('external-import-service', 'active', 0, 0, 0)`,
    `INSERT INTO system_principals (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
      VALUES ('external-import-principal', 'external-import-service', 'service', 'Directory synchronization', NULL, 1, 0, 0)`,
    `INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
      VALUES ('import-global', 'custom:import-global', 'custom', NULL, 'Account grants', 0, 0),
        ('import-provider', 'custom:import-provider', 'custom', 'system:identity_provider', 'Provider writer', 0, 0),
        ('import-member', 'custom:import-member', 'custom', NULL, 'Imported member', 0, 0)`,
    `INSERT INTO system_iam_role_permissions (role_id, permission_key)
      VALUES ('import-global', 'iam:write'), ('import-global', 'org:read'), ('import-global', 'employee:read'),
        ('import-provider', 'account:manage'), ('import-provider', 'employee:write'),
        ('import-member', 'org:read'), ('import-member', 'employee:read')`,
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
      VALUES ('import-global-binding', 'external-import-service', 'import-global', NULL, NULL, 0, NULL)`,
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
      VALUES ('import-provider-binding', 'external-import-service', 'import-provider', 'system:identity_provider', 'oidc', 0, NULL)`,
  ])
  await database
    .prepare(`INSERT INTO system_machine_credentials
    (id, principal_id, name, secret_hash, status, created_at, updated_at)
    VALUES (?1, 'external-import-principal', 'Primary', ?2, 'active', 0, 0)`)
    .bind(credentialId, hash)
    .run()
  // 同期主体の機械sessionを正規routeで発行し、Company同期がその発行記録を確認できるようにする。
  const response = await systemFactory
    .createApp()
    .post("/system/machine-sessions", ...POST)
    .request(
      "/system/machine-sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential_id: credentialId, secret: "1".repeat(64) }),
      },
      { DB: database, JWT_SECRET: "leave-procedure-local-d1-secret", NOW: now.toISOString() },
    )
  if (response.status !== 201)
    throw new Error(`machine session failed: ${response.status} ${await response.text()}`)
  const organizationRevision = await database
    .prepare("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
    .first<number>("revision")
  if (organizationRevision === null) throw new Error("missing organization")
  const actor = { accountId, tokenVersion: 0, credentialId, issuedAtMs: now.getTime() }
  const applied = await new ApplyExternalIdentities({
    repository: new ExternalIdentityImportRepository({
      env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
    }),
    actor,
    now: () => now,
  }).execute({
    commandId: "import:first",
    expectedRevision: organizationRevision,
    reason: "Confirmed directory update",
    identities: [0, 1, 2, 3].map((index) => ({
      subject: `member-${index}`,
      sourceRevision: 1,
      email: `member-${index}@example.com`,
      name: `Member ${index}`,
      accountId: null,
      initialRoleId: iamRoleIdSchema.parse("import-member"),
      newEmployee: { hireDate: "2026-01-01", employmentType: "PART_TIME" as const },
    })),
  })
  if (applied.kind !== "applied") throw new Error(`identity setup failed: ${applied.kind}`)
  const people = (
    await database
      .prepare(`SELECT employee.id, link.account_id FROM company_employees employee
    JOIN company_account_employee_links link ON link.employee_id = employee.id ORDER BY employee.official_name`)
      .all<{ id: string; account_id: string }>()
  ).results.map((row) => ({
    employeeId: restoreWorkforceId("employee", row.id),
    accountId: zAccountId.parse(row.account_id),
  }))
  const creator = people[0]
  if (creator === undefined) throw new Error("creator fixture is missing")
  const date = resolveCompanyBusinessDate({ now: now.toISOString(), timeZone: "Asia/Tokyo" })
  if (date instanceof Error) throw date
  const base = {
    organizationId: "organization:default",
    revision: 1,
    effectiveFrom: restoreCalendarDate(date),
    effectiveTo: null,
  }
  const resources: CompanyResourceProps[] = [
    {
      ...base,
      state: "active",
      type: "responsibility",
      id: "responsibility:approve",
      attributes: { code: "APPROVE", officialName: "Approval" },
    },
    {
      ...base,
      state: "active",
      type: "authority-scope",
      id: "scope:amount",
      attributes: {
        scopeType: "amount",
        currencyCode: "JPY",
        minimumAmount: 100,
        maximumAmount: 1000,
      },
    },
    {
      ...base,
      state: "active",
      type: "collective-body",
      id: "body:committee",
      attributes: {
        code: "COMMITTEE",
        officialName: "Committee",
        quorumType: "count",
        quorumValue: 2,
        decisionRule: "majority",
      },
    },
    {
      ...base,
      state: "active",
      type: "responsibility-assignment",
      id: "assignment:approve",
      attributes: {
        responsibilityId: "responsibility:approve",
        holderType: "collective-body",
        holderId: "body:committee",
        authorityScopeId: "scope:amount",
        delegationAllowed: false,
      },
    },
    ...people.slice(1).map(
      (person, index): CompanyResourceProps => ({
        ...base,
        state: "active",
        type: "collective-body-membership",
        id: `membership:${index}`,
        attributes: {
          collectiveBodyId: "body:committee",
          employeeId: person.employeeId,
          role: "member",
          voting: true,
        },
      }),
    ),
  ]
  const write = async (changes: ReadonlyArray<CompanyResourceProps>) => {
    const revision = await database
      .prepare("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
      .first<number>("revision")
    if (revision === null) throw new Error("organization is missing")
    const change = CompanyResourceChangeEntity.create({
      commandId: crypto.randomUUID(),
      expectedRevision: revision,
      actorAccountId: actor.accountId,
      reason: "Update decision policy",
      recordedAt: now.getTime(),
      resources: changes,
    })
    if (change instanceof Error) throw change
    const saved = await new D1CompanyResourceRepository({ database }).write(change)
    if (saved.kind !== "applied")
      throw new Error(`governance setup failed: ${saved.kind}`, { cause: saved })
  }
  await write(resources)
  const accountLinks = await new D1CompanyResourceRepository({ database }).findMany({
    organizationId: "organization:default",
    types: ["account-employee-link"],
  })
  if (!accountLinks.ok) throw accountLinks.cause
  resources.push(...accountLinks.resources)
  const step: ApplicationWorkflowStep = {
    key: "governance-review",
    name: "Committee review",
    approvers: [],
    approval_mode: "any",
    condition_mode: "all",
    conditions: [],
    due_days: null,
    escalation_approvers: [],
    rejection_behavior: "reject",
    allow_delegation: true,
    governance_authority: {
      organization_id: "organization:default",
      responsibility_code: "APPROVE",
      scope: { scope_type: "amount", currency_code: "JPY", amount_field: "amount" },
    },
  }
  const context: CompanyContext = {
    env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo", NOW: now.toISOString() },
    var: {
      database: drizzle(database),
      auditContext: {
        requestId: "governance-test",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }
  return { database, creator, people, resources, write, step, context, at: now }
}

/** 実Company資格とSystem案件を持つ提出前の休暇を、名前付きのローカルD1へ用意する。 */
export async function createLeaveProcedureLocalD1Context(local: LocalD1, name: string) {
  const c = await createGovernance(await local.database(name))
  const requester = c.creator
  const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
  if (
    assignment === undefined ||
    assignment.type !== "responsibility-assignment" ||
    c.step.governance_authority === undefined
  )
    throw new Error("responsibility fixture missing")
  await c.write([
    {
      ...assignment,
      revision: 2,
      attributes: { ...assignment.attributes, authorityScopeId: null },
    },
  ])
  const step = { ...c.step, governance_authority: { ...c.step.governance_authority, scope: null } }
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: { version: 1, steps: [step] },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "leave_request",
    revision: 1,
    title: "Leave approval",
    category: "leave",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "leave.request.authorize",
    createdByAccountId: requester.accountId,
    createdAt: c.at,
  })
  if (definition instanceof Error) throw definition
  await publishLeaveProcedureDefinition(c.context, definition)
  const leave = LeaveRequest.create({
    employeeId: requester.employeeId,
    leaveType: "annual",
    startDate: "2027-01-01",
    endDate: "2027-01-01",
    days: 1,
    unit: "full_day",
    hours: null,
    consumedDays: 1,
    reason: "Leave",
    createdAt: c.at.toISOString(),
  })
  const requestId = await c.database
    .prepare(`INSERT INTO leave_requests
    (employee_id, leave_type, start_date, end_date, days, unit, consumed_days, reason, status, created_at)
    VALUES (?1, 'annual', '2027-01-01', '2027-01-01', 1, 'full_day', 1, 'Leave', 'pending', ?2)
    RETURNING id`)
    .bind(requester.employeeId, c.at.toISOString())
    .first<number>("id")
  if (requestId === null) throw new Error("leave fixture missing")
  const resolved = await resolveCompanyGovernanceTask(c.context, {
    step,
    payload: leave.toProposalBody(),
    subjectEmployeeId: requester.employeeId,
    excludedEmployeeIds: new Set([requester.employeeId]),
    openedAt: c.at,
    dueAt: null,
    resolvedAt: c.at,
  })
  if (resolved instanceof Error) throw resolved
  const requestKey = crypto.randomUUID()
  const proposal = await ProposalEntity.create({
    id: createProposalId(),
    seriesId: requestKey,
    version: 1,
    procedureKey: definition.key,
    procedureRevision: definition.revision,
    body: leave.toProposalBody(),
    createdByAccountId: requester.accountId,
    supersedesProposalId: null,
    createdAt: c.at,
  })
  if (proposal instanceof Error) throw proposal
  const workflowCase = SystemCaseEntity.create({
    id: createSystemCaseId(),
    subject: { context: "leave", kind: "request", id: requestKey, version: "1" },
    proposalDigest: proposal.digest,
    createdByAccountId: requester.accountId,
    status: "pending",
    createdAt: c.at,
    updatedAt: c.at,
  })
  if (workflowCase instanceof Error) throw workflowCase
  const firstTask = createSystemDecisionTask({
    task: resolved.task,
    caseId: workflowCase.id,
    createdByAccountId: requester.accountId,
    proposalDigest: proposal.digest,
  })
  if (firstTask instanceof Error) throw firstTask
  const audit = SystemAuditEventEntity.create({
    actorAccountId: requester.accountId,
    action: "leave.request.submitted",
    targetType: "leave.request",
    targetId: requestKey,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: JSON.stringify({ proposalDigest: proposal.digest }),
    metadataJson: null,
    occurredAt: c.at,
  })
  if (audit instanceof Error) throw audit
  const repository = new LeaveProcedureRepository(createTestContextForDatabase(c.database))
  const submission = {
    requestKey,
    leaveRequestId: requestId,
    previousLeaveRequestId: null,
    workflow: { proposal, workflowCase, firstTask },
    guards: resolved.guards,
    audit,
  }
  return { ...c, repository, submission, requestId, step }
}

/** 提出済みの休暇へ判断権限と残数を用意し、判断と業務確定を個別に呼べるようにする。 */
export async function createLeaveProcedureDecisionLocalD1Context(local: LocalD1, name: string) {
  const c = await createLeaveProcedureLocalD1Context(local, name)
  const binding = await c.repository.submit(c.submission)
  if (binding instanceof Error) throw binding
  await runAll(c.database, [
    `INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
      VALUES ('leave-decision-test','test:leave-decision','custom','Leave decision',0,0)`,
    `INSERT INTO system_iam_role_permissions (role_id,permission_key)
      VALUES ('leave-decision-test','leave:approve')`,
  ])
  for (const actor of c.people) {
    await c.database
      .prepare(
        "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES (?1,?2,'leave-decision-test',0)",
      )
      .bind(`leave-decision-test:${actor.accountId}`, actor.accountId)
      .run()
  }
  await c.database
    .prepare(
      "INSERT INTO leave_balances (employee_id,fiscal_year,leave_type,granted_days,used_days,remaining_days) VALUES (?1,'2026','annual',10,0,10)",
    )
    .bind(c.creator.employeeId)
    .run()
  const base = createTestContextForDatabase(c.database)
  const context = { ...base, env: { ...base.env, NOW: c.at.toISOString() } }
  const command = (index: number, action: "approve" | "reject" = "approve") => {
    const actor = c.people[index]
    if (actor === undefined) throw new Error("decision actor missing")
    return {
      leaveRequestId: c.requestId,
      session: {
        accountId: actor.accountId,
        employeeId: actor.employeeId,
        hasPermission: (key: string) => key === "leave:approve",
      },
      tokenVersion: 0,
      decisionTarget: {
        proposalVersion: 1,
        proposalDigest: binding.proposalDigest,
        taskKey: c.step.key,
        taskRound: 1,
      },
      action,
      comment: "Reviewed",
      decidedAt: c.at,
    }
  }
  const decide = (index: number, action: "approve" | "reject" = "approve") =>
    new RecordLeaveDecision(context).run(command(index, action))
  const complete = (action: "approve" | "reject" = "approve") => {
    const input = command(2, action)
    return new (action === "approve"
      ? CompleteApprovedLeaveProcedure
      : CompleteRejectedLeaveProcedure)(context).run({ ...input, completedAt: c.at })
  }
  const prepareCompletion = async (action: "approve" | "reject" = "approve") => {
    for (const index of [1, 2]) {
      const result = await decide(index, action)
      if (result instanceof Error) throw result
    }
  }
  const persisted = () =>
    c.database
      .prepare(`SELECT status,
    (SELECT used_days FROM leave_balances WHERE employee_id = ?2) AS used,
    (SELECT count(*) FROM system_human_attestations WHERE case_id = ?3) AS attestations,
    (SELECT count(*) FROM leave_decision_notifications WHERE leave_request_id = ?1) AS notifications
    FROM leave_requests WHERE id = ?1`)
      .bind(c.requestId, c.creator.employeeId, binding.caseId)
      .first<{ status: string; used: number; attestations: number; notifications: number }>()
  return { ...c, binding, context, command, decide, complete, prepareCompletion, persisted }
}

/**
 * 休暇手続の定義を初版としてSystemへ公開する。互換ラッパー側のfixtureも同じ関数を使い、
 * System infrastructureへの依存をこのfileだけに留める。
 */
export async function publishLeaveProcedureDefinition(
  context: CompanyContext,
  definition: ProcedureDefinitionEntity,
): Promise<void> {
  const published = await new SystemD1ProcedureRepository(context).publish(definition, 0)
  if (published !== true) throw published
}
