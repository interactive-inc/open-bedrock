import { resolveActiveSystemAccountId } from "@/api/http/accounts/resolve-active-system-account-id"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { fingerprintPersonnelAction } from "@/contexts/company/domain/definitions/fingerprint-personnel-action.definition"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"
import { ResolveOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-organization-authority.adapter"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { FindPersonnelActionRequestAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/find-personnel-action-request.adapter"
import { GetLifecycleState } from "@/contexts/company/interface/operations/employee-lifecycle/get-lifecycle-state"
import { createCompanySystemAuditEvent } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/create-company-system-audit-event"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import type { SystemWorkflowWriter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

export type CreatedPersonnelActionRequest = Readonly<{
  id: string
  applicationId: number
  targetEmployeeId: EmployeeId | null
  targetEmployeeCode: string
  kind: string
  status: "pending" | "approved" | "rejected" | "withdrawn"
  currentStep: string | null
  createdAt: string
  replayed: boolean
}>

/** Companyの人事変更申請とSystemの判断手続を同じD1 batchで開始する。 */
export class CreatePersonnelActionRequest {
  private static readonly procedureKey = procedureKeySchema.parse("personnel_action_request")
  private static readonly operationKey = "company.personnel-action.apply"

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: {
    idempotencyKey: string
    input: PersonnelActionInput
    baseEmployeeRevision: number
    baseOrganizationRevision: number | null
    createdAt: Date
  }): Promise<CreatedPersonnelActionRequest | ApplicationError> {
    const session = this.c.var.session
    if (session === null) return new ForbiddenError("認証が必要です", "forbidden")
    if (!session.hasPermission("employee:lifecycle:request")) {
      return new ForbiddenError("人事変更を申請する権限がありません", "forbidden")
    }
    if (command.input.kind === "initial_state") {
      return new ValidationError(
        "この人事変更は専用の登録経路を使用してください",
        "personnel_action_invalid_transition",
      )
    }
    if (!Number.isFinite(command.createdAt.getTime())) {
      return new ValidationError("申請日時が不正です", "personnel_action_invalid_transition")
    }
    const company = {
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: this.c.env.NOW,
      },
      var: { database: this.c.var.database, auditContext: this.c.var.auditContext },
    }
    const directory = new CompanyEmployeeDirectoryReadAdapter(company)
    const employeeCode =
      command.input.kind === "corrected"
        ? command.input.replacementAction.employeeCode
        : command.input.employeeCode
    const [target, requester] = await Promise.all([
      directory.findByCode(employeeCode),
      directory.findById(session.employeeId),
    ])
    if (target instanceof Error || requester instanceof Error) {
      return new UnexpectedError("人事変更申請の参加者を取得できません", {
        cause: target instanceof Error ? target : requester,
      })
    }
    if (requester === null || requester.employeeCode === null) {
      return new UnexpectedError("申請者のCompany従業員が見つかりません")
    }
    const completed = await this.findCompletedRequest({
      idempotencyKey: command.idempotencyKey,
      input: command.input,
      requesterId: requester.id,
      employeeCode,
      baseEmployeeRevision: command.baseEmployeeRevision,
      baseOrganizationRevision: command.baseOrganizationRevision,
    })
    if (completed instanceof ApplicationError) return completed
    if (completed !== null) return completed
    const prospective = command.input.kind === "hire"
    if (!prospective && target === null) {
      return new ValidationError(
        "対象従業員が見つかりません",
        "personnel_action_invalid_transition",
      )
    }
    if (prospective && target !== null) {
      return new ConflictError("従業員コードはすでに使用されています", "idempotency_conflict")
    }
    const targetDepartmentCode =
      "departmentCode" in command.input ? (command.input.departmentCode ?? null) : null
    const authority = await this.validateAuthority({
      requesterId: requester.id,
      requesterCode: requester.employeeCode,
      targetId: target?.id ?? null,
      prospective,
      targetDepartmentCode,
    })
    if (authority instanceof ApplicationError) return authority
    const revision = await this.validateRevision({
      targetId: target?.id ?? null,
      prospective,
      employeeRevision: command.baseEmployeeRevision,
      organizationRevision: command.baseOrganizationRevision,
    })
    if (revision instanceof ApplicationError) return revision

    const procedure = await new SystemD1ProcedureRepository({
      env: { DB: this.c.env.DB },
    }).findCurrent(CreatePersonnelActionRequest.procedureKey)
    if (procedure instanceof Error) {
      return new UnexpectedError("人事変更申請手続を取得できません", { cause: procedure })
    }
    if (
      procedure === null ||
      procedure.completionOperationKey !== CreatePersonnelActionRequest.operationKey
    ) {
      return new UnprocessableError("人事変更申請手続が構成されていません", "workflow_unresolvable")
    }
    let policyInput: unknown
    try {
      policyInput = JSON.parse(procedure.decisionPolicyJson)
    } catch (cause) {
      return new UnexpectedError("人事変更申請手続が不正です", { cause })
    }
    const policy = parseCompanyProcedureDecisionPolicy(policyInput)
    if (policy instanceof Error) {
      return new UnexpectedError("人事変更申請手続が不正です", { cause: policy })
    }
    const task = await new ResolveCompanyProcedureTaskAdapter({
      c: company,
      policy,
      payload: command.input,
      applicant: {
        employeeId: requester.id,
        employeeCode: requester.employeeCode,
        employmentStatus: requester.employment?.status ?? null,
        organizationUnitId: requester.primaryAssignment?.organizationUnitId ?? null,
        organizationUnitCode: requester.primaryAssignment?.organizationUnitCode ?? null,
        organizationUnitName: requester.primaryAssignment?.organizationUnitName ?? null,
        positionTitle: requester.primaryAssignment?.positionTitle ?? null,
      },
      activatedAt: command.createdAt,
      afterTaskKey: null,
      authoritySubjectEmployeeId: target?.id ?? null,
      targetDepartmentCode,
      excludedEmployeeIds: new Set(target === null ? [requester.id] : [requester.id, target.id]),
    }).resolveCompanyProcedureTask()
    if (task instanceof Error || task === null) {
      return new UnprocessableError("適用可能な承認手順がありません", "workflow_unresolvable", {
        cause: task instanceof Error ? task : undefined,
      })
    }
    const accountId = await resolveActiveSystemAccountId(this.c, session.accountId)
    if (accountId instanceof Error) {
      return new UnexpectedError("申請者のSystemアカウントを解決できません", {
        cause: accountId,
      })
    }
    const requestId = command.idempotencyKey
    const seriesId = command.idempotencyKey
    const payload = CanonicalSystemJsonValue.create(command.input)
    if (payload instanceof Error) {
      return new UnexpectedError("人事変更申請を正規化できません", { cause: payload })
    }
    const fingerprint = await fingerprintPersonnelAction(
      target?.id ?? `prospective:${employeeCode}`,
      command.input,
    )
    const createdAtSeconds = Math.floor(command.createdAt.getTime() / 1_000)
    const audit = createCompanySystemAuditEvent({
      actorAccountId: String(accountId),
      actorEmployeeId: requester.id,
      action: "employee.lifecycle.requested",
      targetType: "employee",
      targetId: target === null ? null : String(target.id),
      outcome: "succeeded",
      reasonCode: null,
      authorization: { permission: "employee:lifecycle:request" },
      before: null,
      after: null,
      metadata: {
        actionKind: command.input.kind,
        effectiveOn:
          command.input.kind === "retired" ? command.input.retirementOn : command.input.eventOn,
      },
      occurredAt: command.createdAt,
      requestAudit: this.c.var.auditContext,
    })
    if (audit instanceof Error) {
      return new UnexpectedError("人事変更申請の監査記録を作成できません", { cause: audit })
    }
    const subjectSnapshotJson =
      command.input.kind === "hire"
        ? JSON.stringify({
            employeeCode: command.input.employeeCode,
            employeeName: command.input.employeeName,
          })
        : null

    const systemWriter = new SystemD1WorkflowAdapter({ env: { DB: this.c.env.DB } })
    const writer: SystemWorkflowWriter = {
      start: async (input) => {
        const systemStatements = systemWriter.prepareStartStatements(input)
        const finalNumberRead = systemStatements.at(-1)
        if (finalNumberRead === undefined)
          return new Error("System proposal number read is missing")
        const association = this.c.env.DB.prepare(
          `INSERT INTO company_personnel_action_requests
             (id, application_id, system_proposal_series_id, target_employee_id,
              subject_snapshot_json, target_department_code, kind, payload_json,
              payload_fingerprint, requested_by_employee_id, base_employee_revision,
              base_organization_revision, created_at, applied_action_id)
           VALUES (?1, (SELECT number FROM system_proposal_numbers WHERE series_id = ?2),
                   ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL)`,
        ).bind(
          requestId,
          seriesId,
          target?.id ?? null,
          subjectSnapshotJson,
          targetDepartmentCode,
          command.input.kind,
          payload.toString(),
          fingerprint,
          requester.id,
          command.baseEmployeeRevision,
          command.baseOrganizationRevision,
          createdAtSeconds,
        )
        try {
          const results = await this.c.env.DB.batch<{ number: number }>([
            ...systemStatements.slice(0, -1),
            association,
            abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
            ...new SystemAuditEventRepository({
              env: { DB: this.c.env.DB },
            }).prepareAppend(audit),
            finalNumberRead,
          ])
          return results.at(-1)?.results.at(0)?.number ?? new Error("proposal number is missing")
        } catch (cause) {
          return cause instanceof Error
            ? cause
            : new Error("failed to create personnel action request", { cause })
        }
      },
      decide: (input) => systemWriter.decide(input),
      cancel: (input) => systemWriter.cancel(input),
      reassign: (input) => systemWriter.reassign(input),
    }
    const started = await new StartSystemProcedure({ writer }).run({
      seriesId,
      version: 1,
      procedureKey: procedure.key,
      procedureRevision: procedure.revision,
      body: command.input,
      createdByAccountId: accountId,
      supersedesProposalId: null,
      createdAt: command.createdAt,
      firstTask: task.task,
      subject: {
        context: "company",
        kind: "personnel-action-request",
        id: requestId,
        version: "1",
      },
    })
    if (started instanceof Error) {
      const completedAfterRace = await this.findCompletedRequest({
        idempotencyKey: command.idempotencyKey,
        input: command.input,
        requesterId: requester.id,
        employeeCode,
        baseEmployeeRevision: command.baseEmployeeRevision,
        baseOrganizationRevision: command.baseOrganizationRevision,
      })
      if (completedAfterRace !== null) return completedAfterRace
      return new UnexpectedError("人事変更申請を作成できません", { cause: started })
    }
    return {
      id: requestId,
      applicationId: started.number,
      targetEmployeeId: target?.id ?? null,
      targetEmployeeCode: employeeCode,
      kind: command.input.kind,
      status: "pending",
      currentStep: task.key,
      createdAt: command.createdAt.toISOString(),
      replayed: false,
    }
  }

  private async findCompletedRequest(input: {
    idempotencyKey: string
    input: PersonnelActionInput
    requesterId: EmployeeId
    employeeCode: string
    baseEmployeeRevision: number
    baseOrganizationRevision: number | null
  }): Promise<CreatedPersonnelActionRequest | ApplicationError | null> {
    const session = this.c.var.session
    if (session === null) return new ForbiddenError("認証が必要です", "forbidden")
    const existing = await new FindPersonnelActionRequestAdapter({
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: this.c.env.NOW,
      },
      var: { database: this.c.var.database, auditContext: this.c.var.auditContext },
    }).findPersonnelActionRequest(session, { id: input.idempotencyKey })
    if (existing instanceof CompanyOperationError) {
      return new UnexpectedError("完了済み人事変更申請を検証できません", { cause: existing })
    }
    if (existing === null) return null
    const fingerprint = await fingerprintPersonnelAction(
      existing.targetEmployeeId ?? `prospective:${input.employeeCode}`,
      input.input,
    )
    if (
      existing.payloadFingerprint !== fingerprint ||
      existing.requestedByEmployeeId !== input.requesterId ||
      existing.targetEmployeeCode !== input.employeeCode ||
      existing.baseEmployeeRevision !== input.baseEmployeeRevision ||
      existing.baseOrganizationRevision !== input.baseOrganizationRevision
    ) {
      return new ConflictError(
        "Idempotency-Key is already used by another personnel action request",
        "idempotency_conflict",
      )
    }
    return {
      id: existing.id,
      applicationId: existing.applicationId,
      targetEmployeeId: existing.targetEmployeeId,
      targetEmployeeCode: existing.targetEmployeeCode,
      kind: existing.kind,
      status: existing.status,
      currentStep: existing.currentStep,
      createdAt: new Date(existing.createdAt * 1_000).toISOString(),
      replayed: true,
    }
  }

  private async validateAuthority(input: {
    requesterId: EmployeeId
    requesterCode: string
    targetId: EmployeeId | null
    prospective: boolean
    targetDepartmentCode: string | null
  }): Promise<true | ApplicationError> {
    const session = this.c.var.session
    if (session?.hasPermission("employee:lifecycle:read:all")) return true
    if (input.prospective) {
      const organization = await new CurrentOrganizationReadModelAdapter(
        this.c,
      ).loadCurrentOrganization()
      if (organization instanceof Error) {
        return new UnexpectedError("組織スコープを解決できません", { cause: organization })
      }
      return input.targetDepartmentCode !== null &&
        organization.managerByDepartmentCode.get(input.targetDepartmentCode) === input.requesterCode
        ? true
        : new ForbiddenError("対象組織への入社を申請できません", "forbidden")
    }
    if (input.targetId === null) {
      return new ForbiddenError("対象従業員の人事変更を申請できません", "forbidden")
    }
    const authority = await new ResolveOrganizationAuthorityAdapter(
      this.c,
    ).resolveOrganizationAuthority(input.requesterId, input.targetId)
    if (authority instanceof Error) {
      return new UnexpectedError("組織スコープを解決できません", { cause: authority })
    }
    return authority.managementChain || authority.departmentManager
      ? true
      : new ForbiddenError("対象従業員の人事変更を申請できません", "forbidden")
  }

  private async validateRevision(input: {
    targetId: EmployeeId | null
    prospective: boolean
    employeeRevision: number
    organizationRevision: number | null
  }): Promise<true | ApplicationError> {
    if (!Number.isInteger(input.employeeRevision) || input.employeeRevision < 0) {
      return new ValidationError("人事revisionが不正です", "personnel_action_stale")
    }
    if (input.prospective) {
      const revision = await this.c.env.DB.prepare(
        "SELECT revision FROM company_organization_lifecycle_states WHERE id = 1",
      ).first<number>("revision")
      return input.employeeRevision === 0 &&
        (input.organizationRevision === null || input.organizationRevision === revision)
        ? true
        : new ConflictError("人事情報が更新されています", "personnel_action_stale")
    }
    if (input.targetId === null) {
      return new ValidationError("対象従業員が不正です", "personnel_action_invalid_transition")
    }
    const state = await new GetLifecycleState(this.c).run({ employeeId: input.targetId })
    if (state instanceof CompanyOperationError) {
      return new UnexpectedError("従業員の人事状態を取得できません", { cause: state })
    }
    return state.employeeRevision === input.employeeRevision &&
      (input.organizationRevision === null ||
        state.organizationRevision === input.organizationRevision)
      ? true
      : new ConflictError("人事情報が更新されています", "personnel_action_stale")
  }
}
