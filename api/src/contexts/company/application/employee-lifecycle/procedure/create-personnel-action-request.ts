import { createAuditEvent } from "@/contexts/company/application/audit/company-audit-event"
import { fingerprintPersonnelAction } from "@/contexts/company/application/employee-lifecycle/fingerprint-personnel-action"
import { GetLifecycleState } from "@/contexts/company/application/employee-lifecycle/get-lifecycle-state"
import { resolveActiveSystemAccountId } from "@/contexts/company/application/iam/to-system-account-id"
import { loadCurrentOrganization } from "@/contexts/company/application/organization/current-organization-read-model"
import { resolveOrganizationAuthority } from "@/contexts/company/application/organization/resolve-organization-authority"
import { resolveCompanyProcedureTask } from "@/contexts/company/application/organization/resolve-company-procedure-task"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/organization/company-procedure-decision-policy"
import type { PersonnelActionInput } from "@/contexts/company/domain/employee-lifecycle/lifecycle-types"
import type { Session } from "@/contexts/company/domain/iam/session"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import { PersonnelActionSystemWorkflowWriter } from "@/contexts/company/infrastructure/employee-lifecycle/personnel-action-system-workflow-writer"
import type { Context } from "@/env"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { procedureKeySchema } from "@system/domain/workflow/procedure-definition.entity"
import { toCanonicalSystemJson } from "@system/domain/workflow/to-canonical-system-json"
import { SystemD1ProcedureRepository } from "@system/infrastructure/workflow/system-d1-procedure-repository"

export type CreatedPersonnelActionRequest = {
  id: string
  applicationId: number
  targetEmployeeId: number | null
  targetEmployeeCode: string
  kind: string
  status: "pending"
  currentStep: string
  createdAt: string
}

const PERSONNEL_ACTION_PROCEDURE_KEY = procedureKeySchema.parse("personnel_action_request")
const PERSONNEL_ACTION_OPERATION_KEY = "company.personnel-action.apply"

function targetDepartmentCode(input: PersonnelActionInput): string | null {
  return "departmentCode" in input ? (input.departmentCode ?? null) : null
}

function eventOn(input: PersonnelActionInput): string {
  return input.kind === "retired" ? input.retirementOn : input.eventOn
}

export class CreatePersonnelActionRequest {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: {
    session: Session
    input: PersonnelActionInput
    baseEmployeeRevision: number
    baseOrganizationRevision: number | null
    createdAt: string
  }): Promise<CreatedPersonnelActionRequest | ApplicationError> {
    if (!command.session.hasPermission("employee:lifecycle:request")) {
      return new ForbiddenError("人事変更を申請する権限がありません", "forbidden")
    }
    if (command.input.kind === "legacy_baseline") {
      return new ValidationError(
        "この人事変更は専用の登録経路を使用してください",
        "personnel_action_invalid_transition",
      )
    }
    const employeeCode =
      command.input.kind === "corrected"
        ? command.input.replacementAction.employeeCode
        : command.input.employeeCode
    const target = await new EmployeeRepository(this.c).findByCode(employeeCode)
    if (target instanceof Error) {
      return new UnexpectedError("対象従業員を取得できません", { cause: target })
    }
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
    const requester = await new EmployeeRepository(this.c).findById(command.session.employeeId)
    if (requester instanceof Error || requester === null) {
      return new UnexpectedError("申請者を取得できません", { cause: requester ?? undefined })
    }
    const authorityError = await this.validateRequestAuthority({
      session: command.session,
      requesterCode: requester.code,
      targetEmployeeId: target?.id ?? null,
      prospective,
      departmentCode: targetDepartmentCode(command.input),
    })
    if (authorityError !== null) return authorityError
    const revisionError = await this.validateRevisions({
      targetEmployeeId: target?.id ?? null,
      prospective,
      baseEmployeeRevision: command.baseEmployeeRevision,
      baseOrganizationRevision: command.baseOrganizationRevision,
    })
    if (revisionError !== null) return revisionError

    const procedure = await new SystemD1ProcedureRepository({
      env: { DB: this.c.env.DB },
    }).findCurrent(PERSONNEL_ACTION_PROCEDURE_KEY)
    if (procedure instanceof Error) {
      return new UnexpectedError("人事変更申請手続を取得できません", { cause: procedure })
    }
    if (procedure === null || procedure.completionOperationKey !== PERSONNEL_ACTION_OPERATION_KEY) {
      return new UnprocessableError("人事変更申請手続が構成されていません", "workflow_unresolvable")
    }
    let decisionPolicy: unknown
    try {
      decisionPolicy = JSON.parse(procedure.decisionPolicyJson)
    } catch (cause) {
      return new UnexpectedError("人事変更申請手続が不正です", { cause })
    }
    const policy = parseCompanyProcedureDecisionPolicy(decisionPolicy)
    if (policy instanceof Error) {
      return new UnexpectedError("人事変更申請手続が不正です", { cause: policy })
    }
    const createdAt = new Date(command.createdAt)
    const createdAtSeconds = Math.floor(createdAt.getTime() / 1_000)
    if (!Number.isFinite(createdAtSeconds)) {
      return new ValidationError("申請日時が不正です", "personnel_action_invalid_transition")
    }
    const task = await resolveCompanyProcedureTask({
      c: this.c,
      policy,
      payload: command.input,
      applicant: {
        id: requester.id,
        code: requester.code,
        dept_id: requester.deptId,
        dept_name: requester.deptName,
        position: requester.position,
        status: requester.status,
      },
      authoritySubjectEmployeeId: target?.id ?? null,
      activatedAt: createdAt,
      afterTaskKey: null,
      excludedEmployeeIds: new Set(target === null ? [requester.id] : [requester.id, target.id]),
      targetDepartmentCode: targetDepartmentCode(command.input),
    })
    if (task instanceof Error || task === null) {
      return new UnprocessableError("適用可能な承認手順がありません", "workflow_unresolvable", {
        cause: task instanceof Error ? task : undefined,
      })
    }
    const accountId = await resolveActiveSystemAccountId(this.c, command.session.accountId)
    if (accountId instanceof Error) {
      return new UnexpectedError("申請者のSystemアカウントを解決できません", {
        cause: accountId,
      })
    }
    const requestId = crypto.randomUUID()
    const seriesId = crypto.randomUUID()
    const fingerprint = await fingerprintPersonnelAction(
      target?.id ?? `prospective:${employeeCode}`,
      command.input,
    )
    const payloadJson = toCanonicalSystemJson(command.input)
    if (payloadJson instanceof Error) {
      return new UnexpectedError("人事変更申請を正規化できません", { cause: payloadJson })
    }
    const audit = createAuditEvent(
      {
        actorAccountId: command.session.accountId,
        actorEmployeeId: command.session.employeeId,
        action: "employee.lifecycle.requested",
        target: { type: "employee", id: target === null ? null : String(target.id) },
        outcome: "succeeded",
        reasonCode: null,
        authorization: { permission: "employee:lifecycle:request" },
        metadata: { actionKind: command.input.kind, effectiveOn: eventOn(command.input) },
        now: createdAt,
      },
      this.c.var.auditContext,
    )
    const writer = new PersonnelActionSystemWorkflowWriter(this.c, {
      id: requestId,
      targetEmployeeId: target?.id ?? null,
      subjectSnapshotJson:
        command.input.kind === "hire"
          ? JSON.stringify({
              employeeCode: command.input.employeeCode,
              employeeName: command.input.employeeName,
            })
          : null,
      targetDepartmentCode: targetDepartmentCode(command.input),
      kind: command.input.kind,
      payloadJson,
      payloadFingerprint: fingerprint,
      requestedByEmployeeId: requester.id,
      baseEmployeeRevision: command.baseEmployeeRevision,
      baseOrganizationRevision: command.baseOrganizationRevision,
      createdAt: createdAtSeconds,
      auditStatements: new AuditEventRepository(this.c).prepareAppend(audit),
    })
    const started = await new StartSystemProcedure(writer).run({
      seriesId,
      version: 1,
      procedureKey: procedure.key,
      procedureRevision: procedure.revision,
      body: command.input,
      createdByAccountId: accountId,
      supersedesProposalId: null,
      createdAt,
      firstTask: task.task,
      subject: {
        context: "company",
        kind: "personnel-action-request",
        id: requestId,
        version: "1",
      },
    })
    if (started instanceof Error) {
      return new UnexpectedError("人事変更申請を作成できません", { cause: started })
    }

    return {
      id: requestId,
      applicationId: started.number,
      targetEmployeeId: target?.id ?? null,
      targetEmployeeCode: target?.code ?? employeeCode,
      kind: command.input.kind,
      status: "pending",
      currentStep: task.key,
      createdAt: command.createdAt,
    }
  }

  private async validateRequestAuthority(
    input: Readonly<{
      session: Session
      requesterCode: string | null
      targetEmployeeId: number | null
      prospective: boolean
      departmentCode: string | null
    }>,
  ): Promise<ApplicationError | null> {
    if (input.session.hasPermission("employee:lifecycle:read:all")) return null
    if (input.prospective) {
      const organization = await loadCurrentOrganization(this.c)
      if (organization instanceof Error) {
        return new UnexpectedError("組織スコープを解決できません", { cause: organization })
      }
      if (
        input.departmentCode === null ||
        organization.managerByDepartmentCode.get(input.departmentCode) !== input.requesterCode
      ) {
        return new ForbiddenError("対象部署への入社を申請できません", "forbidden")
      }
      return null
    }
    const authority = await resolveOrganizationAuthority(
      this.c,
      input.session.employeeId,
      input.targetEmployeeId ?? 0,
    )
    if (authority instanceof Error) {
      return new UnexpectedError("組織スコープを解決できません", { cause: authority })
    }
    return authority.managementChain || authority.departmentManager
      ? null
      : new ForbiddenError("対象従業員の人事変更を申請できません", "forbidden")
  }

  private async validateRevisions(
    input: Readonly<{
      targetEmployeeId: number | null
      prospective: boolean
      baseEmployeeRevision: number
      baseOrganizationRevision: number | null
    }>,
  ): Promise<ApplicationError | null> {
    if (input.prospective) {
      const organizationRevision = await this.c.env.DB.prepare(
        "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
      ).first<number>("revision")
      return input.baseEmployeeRevision !== 0 ||
        (input.baseOrganizationRevision !== null &&
          input.baseOrganizationRevision !== organizationRevision)
        ? new ConflictError("人事情報が更新されています", "personnel_action_stale")
        : null
    }
    const state = await new GetLifecycleState(this.c).run({
      employeeId: input.targetEmployeeId ?? 0,
    })
    if (state instanceof ApplicationError) return state
    return state.employeeRevision !== input.baseEmployeeRevision ||
      (input.baseOrganizationRevision !== null &&
        state.organizationRevision !== input.baseOrganizationRevision)
      ? new ConflictError("人事情報が更新されています", "personnel_action_stale")
      : null
  }
}
