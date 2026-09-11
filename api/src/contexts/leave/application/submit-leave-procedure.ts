import { PrepareLeaveHumanEmployeeAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-human-employee.adapter"
import { computeConsumedDays } from "@/contexts/leave/domain/policies/compute-consumed-days.policy"
import { validateLeaveUnit } from "@/contexts/leave/domain/policies/validate-leave-unit.policy"
import type { Context } from "@/env"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { createProposalId } from "@system/domain/schemas/workflow/proposal-id.schema"
import { createSystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { createSystemDecisionTask } from "@system/domain/policies/decision-task.policy"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import {
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  ValidationError,
  type ApplicationError,
} from "@/lib/errors"

import { LeaveProcedureRepository } from "@/contexts/leave/infrastructure/repositories/leave-procedure.repository"
import type { LeaveProcedureBinding } from "@/contexts/leave/domain/definitions/leave-procedure.definition"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Command = Readonly<{
  requestKey: string
  leaveRequestId: number
  previousLeaveRequestId: number | null
  confirmedContentDigest: string
  session: CompanyPersonnelSession
  tokenVersion: number
  createdAt: Date
}>
type Result = Readonly<{ binding: LeaveProcedureBinding; replayed: boolean }>

/** 本人が確認した休暇を会社規程へ提出し、再送には同じ案件を返す。 */
export class SubmitLeaveProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Result | ApplicationError> {
    if (
      !z.string().uuid().safeParse(command.requestKey).success ||
      !z.number().int().positive().safe().safeParse(command.leaveRequestId).success ||
      !z.number().int().positive().safe().nullable().safeParse(command.previousLeaveRequestId)
        .success ||
      !/^[a-f0-9]{64}$/.test(command.confirmedContentDigest) ||
      !Number.isSafeInteger(command.createdAt.getTime())
    )
      return new ValidationError("休暇の提出対象が不正です", "invalid_submission")
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["leave:submit"],
      now: command.createdAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("休暇を提出する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("提出資格を取得できません", { cause: human })
    const qualified = await new PrepareLeaveHumanEmployeeAdapter(this.c).prepare({
      accountId: command.session.accountId,
      employeeId: command.session.employeeId,
      now: command.createdAt,
    })
    if (qualified instanceof Error) return qualified
    const { employee: applicant, guard } = qualified
    const request = await new LeaveRequestRepository(this.c).findById(command.leaveRequestId)
    if (request instanceof Error)
      return new UnexpectedError("休暇を取得できません", { cause: request })
    if (request === null || request.employeeId !== applicant.id)
      return new ForbiddenError("本人の休暇ではありません", "forbidden")
    const content = CanonicalSystemJsonValue.create(request.toProposalBody())
    if (content instanceof Error)
      return new UnexpectedError("休暇の内容が不正です", { cause: content })
    const digest = await ProposalDigestValue.create(content)
    if (digest instanceof Error || digest.toString() !== command.confirmedContentDigest)
      return new ConflictError("確認した休暇の内容が変わっています", "submission_changed")
    const repository = new LeaveProcedureRepository(this.c)
    const guards = [...human.assertions, guard]
    const existing = await repository.findForRequest(command.leaveRequestId)
    if (existing instanceof Error)
      return new UnexpectedError("提出履歴を取得できません", { cause: existing })
    if (existing !== null) return this.replay(command, existing, guards)
    if (
      request.status !== "pending" ||
      LeaveRequest.daysBetween(request.startDate, request.endDate) !== request.days ||
      validateLeaveUnit(request) !== null ||
      (request.hours !== null && (!Number.isFinite(request.hours) || request.hours <= 0)) ||
      request.consumedDays !== computeConsumedDays(request)
    )
      return new ConflictError("休暇は提出できない状態です", "submission_changed")
    const definition = await new SystemD1ProcedureRepository(this.c).find(
      procedureKeySchema.parse("leave_request"),
    )
    if (definition instanceof Error)
      return new UnexpectedError("休暇の承認規程を取得できません", { cause: definition })
    if (definition === null || definition.completionOperationKey !== "leave.request.authorize")
      return new ValidationError("休暇の承認規程が設定されていません", "procedure_required")
    const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(definition.decisionPolicyJson))
    if (policy instanceof Error || policy.workflow === null)
      return new ValidationError("休暇の承認規程が不正です", "invalid_procedure")
    const resolved = await new ResolveCompanyProcedureTaskAdapter({
      c: this.c,
      policy,
      payload: request.toProposalBody(),
      activatedAt: command.createdAt,
      afterTaskKey: null,
      applicant: {
        employeeId: applicant.id,
        employeeCode: applicant.employeeCode,
        employmentStatus: qualified.employmentStatus,
        organizationUnitId: applicant.primaryAssignment?.organizationUnitId ?? null,
        organizationUnitCode: applicant.primaryAssignment?.organizationUnitCode ?? null,
        organizationUnitName: applicant.primaryAssignment?.organizationUnitName ?? null,
        positionTitle: applicant.primaryAssignment?.positionTitle ?? null,
      },
      excludedEmployeeIds: new Set([applicant.id]),
    }).resolveCompanyProcedureTask()
    if (resolved instanceof Error || resolved === null)
      return new ValidationError("休暇の承認候補を解決できません", "workflow_unresolvable")
    const proposal = await ProposalEntity.create({
      id: createProposalId(),
      seriesId: command.requestKey,
      version: 1,
      procedureKey: definition.key,
      procedureRevision: definition.revision,
      body: request.toProposalBody(),
      createdByAccountId: command.session.accountId,
      supersedesProposalId: null,
      createdAt: command.createdAt,
    })
    if (proposal instanceof Error)
      return new UnexpectedError("休暇の提案を作成できません", { cause: proposal })
    const workflowCase = SystemCaseEntity.create({
      id: createSystemCaseId(),
      subject: { context: "leave", kind: "request", id: command.requestKey, version: "1" },
      proposalDigest: proposal.digest,
      createdByAccountId: command.session.accountId,
      status: "pending",
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    })
    if (workflowCase instanceof Error)
      return new UnexpectedError("休暇の案件を作成できません", { cause: workflowCase })
    const firstTask = createSystemDecisionTask({
      task: resolved.task,
      caseId: workflowCase.id,
      createdByAccountId: command.session.accountId,
      proposalDigest: proposal.digest,
    })
    if (firstTask instanceof Error)
      return new UnexpectedError("休暇の判断段階を作成できません", { cause: firstTask })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "leave.request.submitted",
      targetType: "leave.request",
      targetId: command.requestKey,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permission: "leave:submit",
        procedureRevision: definition.revision,
      }),
      beforeJson: null,
      afterJson: JSON.stringify({
        proposalDigest: proposal.digest,
        leaveRequestId: command.leaveRequestId,
        previousLeaveRequestId: command.previousLeaveRequestId,
      }),
      metadataJson: JSON.stringify({ ...this.c.var.auditContext, actorEmployeeId: applicant.id }),
      occurredAt: command.createdAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("休暇の提出監査を作成できません", { cause: audit })
    const saved = await repository.submit({
      leaveRequestId: command.leaveRequestId,
      previousLeaveRequestId: command.previousLeaveRequestId,
      requestKey: command.requestKey,
      workflow: { proposal, workflowCase, firstTask },
      guards: [...guards, ...resolved.guards],
      audit,
    })
    if (!(saved instanceof Error)) return { binding: saved, replayed: false }
    const concurrent = await repository.findForRequest(command.leaveRequestId)
    if (concurrent !== null && !(concurrent instanceof Error))
      return this.replay(command, concurrent, guards)
    return new ConflictError("保存までに休暇の提出条件が変わりました", "submission_changed", {
      cause: saved,
    })
  }

  private async replay(
    command: Command,
    binding: LeaveProcedureBinding,
    guards: Parameters<LeaveProcedureRepository["readSubmissionReceipt"]>[0]["guards"],
  ): Promise<Result | ApplicationError> {
    if (
      binding.requestKey !== command.requestKey ||
      binding.proposalDigest !== command.confirmedContentDigest ||
      binding.previousLeaveRequestId !== command.previousLeaveRequestId
    )
      return new ConflictError("再送キーの提出内容が一致しません", "idempotency_conflict")
    const receipt = await new LeaveProcedureRepository(this.c).readSubmissionReceipt({
      binding,
      actorAccountId: command.session.accountId,
      guards,
    })
    if (receipt !== true)
      return new ForbiddenError("提出履歴を取得する資格が変わりました", "forbidden")
    return { binding, replayed: true }
  }
}
