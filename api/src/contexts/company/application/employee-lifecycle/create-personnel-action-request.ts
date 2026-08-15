import type { Session } from "@/contexts/company/domain/iam/session"
import { createAuditEvent } from "@/contexts/company/application/audit/company-audit-event"
import { Application } from "@/contexts/company/domain/application/application.entity"
import type { PersonnelActionInput } from "@/contexts/company/domain/employee-lifecycle/lifecycle-types"
import type { Context } from "@/env"
import { fingerprintPersonnelAction } from "@/contexts/company/application/employee-lifecycle/fingerprint-personnel-action"
import { GetLifecycleState } from "@/contexts/company/application/employee-lifecycle/get-lifecycle-state"
import { ApplicationWorkflowRepository } from "@/contexts/company/infrastructure/application/application-workflow-repository"
import { ApplicationTemplateRepository } from "@/contexts/company/infrastructure/application/application-template-repository"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import { resolveOrganizationAuthority } from "@/contexts/company/application/organization/resolve-organization-authority"
import { loadCurrentOrganization } from "@/contexts/company/application/organization/current-organization-read-model"
import { applicableWorkflowSteps } from "@/contexts/company/application/application/workflow/applicable-workflow-steps"
import { resolveWorkflowStepSnapshot } from "@/contexts/company/application/application/workflow/resolve-workflow-step-snapshot"
import { UnresolvableWorkflowStepError } from "@/contexts/company/application/application/workflow/unresolvable-workflow-step-error"

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
    if (!command.session.hasPermission("employee:lifecycle:read:all")) {
      if (prospective) {
        const organization = await loadCurrentOrganization(this.c)
        if (organization instanceof Error) {
          return new UnexpectedError("組織スコープを解決できません", { cause: organization })
        }
        const departmentCode = targetDepartmentCode(command.input)
        if (
          departmentCode === null ||
          organization.managerByDepartmentCode.get(departmentCode) !== requester.code
        ) {
          return new ForbiddenError("対象部署への入社を申請できません", "forbidden")
        }
      } else {
        const authority = await resolveOrganizationAuthority(
          this.c,
          command.session.employeeId,
          target?.id ?? 0,
        )
        if (authority instanceof Error) {
          return new UnexpectedError("組織スコープを解決できません", { cause: authority })
        }
        if (!authority.managementChain && !authority.departmentManager) {
          return new ForbiddenError("対象従業員の人事変更を申請できません", "forbidden")
        }
      }
    }
    if (prospective) {
      const organizationRevision = await this.c.env.DB.prepare(
        "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
      ).first<number>("revision")
      if (
        command.baseEmployeeRevision !== 0 ||
        (command.baseOrganizationRevision !== null &&
          command.baseOrganizationRevision !== organizationRevision)
      ) {
        return new ConflictError("人事情報が更新されています", "personnel_action_stale")
      }
    } else {
      const state = await new GetLifecycleState(this.c).run({ employeeId: target?.id ?? 0 })
      if (state instanceof ApplicationError) return state
      if (
        state.employeeRevision !== command.baseEmployeeRevision ||
        (command.baseOrganizationRevision !== null &&
          state.organizationRevision !== command.baseOrganizationRevision)
      ) {
        return new ConflictError("人事情報が更新されています", "personnel_action_stale")
      }
    }
    const template = await new ApplicationTemplateRepository(this.c).findByCode(
      "personnel_action_request",
    )
    if (template instanceof Error) {
      return new UnexpectedError("人事変更申請テンプレートを取得できません", { cause: template })
    }
    if (
      template === null ||
      template.id === null ||
      template.systemBinding !== "personnel_action" ||
      template.completionHandlerKey !== "personnel_action"
    ) {
      return new UnprocessableError(
        "人事変更申請テンプレートが構成されていません",
        "workflow_unresolvable",
      )
    }
    const workflowRepository = new ApplicationWorkflowRepository(this.c)
    const workflow = await workflowRepository.findDefinition(template.id)
    if (workflow instanceof Error) {
      return new UnexpectedError("承認フローを取得できません", { cause: workflow })
    }
    if (workflow === null) {
      return new UnprocessableError("承認フローが構成されていません", "workflow_unresolvable")
    }
    const steps = applicableWorkflowSteps({
      workflow,
      payload: command.input,
      applicant: {
        id: requester.id,
        code: requester.code,
        dept_id: requester.deptId,
        dept_name: requester.deptName,
        position: requester.position,
        status: requester.status,
      },
    })
    const firstStep = steps.at(0)
    if (firstStep === undefined) {
      return new UnprocessableError("適用可能な承認手順がありません", "workflow_unresolvable")
    }
    const snapshot = await resolveWorkflowStepSnapshot({
      c: this.c,
      applicantEmployeeId: target?.id ?? null,
      step: firstStep,
      activatedAt: command.createdAt,
      excludedEmployeeIds: new Set(target === null ? [requester.id] : [requester.id, target.id]),
      targetDepartmentCode: targetDepartmentCode(command.input),
    })
    if (snapshot instanceof Error) {
      return snapshot instanceof UnresolvableWorkflowStepError
        ? new UnprocessableError(snapshot.message, "workflow_unresolvable")
        : new UnexpectedError("承認者を解決できません", { cause: snapshot })
    }
    const requestId = crypto.randomUUID()
    const fingerprint = await fingerprintPersonnelAction(
      target?.id ?? `prospective:${employeeCode}`,
      command.input,
    )
    const createdAtSeconds = Math.floor(Date.parse(command.createdAt) / 1_000)
    if (!Number.isFinite(createdAtSeconds)) {
      return new ValidationError("申請日時が不正です", "personnel_action_invalid_transition")
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
        now: new Date(command.createdAt),
      },
      this.c.var.auditContext,
    )
    const created = await workflowRepository.createPersonnelActionRequestWithInstance({
      application: Application.create({
        templateId: template.id,
        applicantId: requester.id,
        currentStep: firstStep.key,
        payload: command.input,
        createdAt: command.createdAt,
      }),
      definition: workflow,
      currentStepKey: firstStep.key,
      startedAt: command.createdAt,
      dueAt: snapshot.dueAt,
      stepSnapshot: snapshot,
      request: {
        id: requestId,
        targetEmployeeId: target?.id ?? null,
        subjectSnapshotJson:
          command.input.kind === "hire"
            ? JSON.stringify({
                employeeCode: command.input.employeeCode,
                employeeName: command.input.employeeName,
              })
            : null,
        kind: command.input.kind,
        payloadJson: JSON.stringify(command.input),
        requestedByEmployeeId: requester.id,
        baseEmployeeRevision: command.baseEmployeeRevision,
        baseOrganizationRevision: command.baseOrganizationRevision,
        createdAt: createdAtSeconds,
        payloadFingerprint: fingerprint,
        targetDepartmentCode: targetDepartmentCode(command.input),
      },
      auditStatements: new AuditEventRepository(this.c).prepareAppend(audit),
    })
    if (created instanceof Error || created.id === null) {
      return new UnexpectedError("人事変更申請を作成できません", { cause: created })
    }
    return {
      id: requestId,
      applicationId: created.id,
      targetEmployeeId: target?.id ?? null,
      targetEmployeeCode: target?.code ?? employeeCode,
      kind: command.input.kind,
      status: "pending",
      currentStep: firstStep.key,
      createdAt: command.createdAt,
    }
  }
}
