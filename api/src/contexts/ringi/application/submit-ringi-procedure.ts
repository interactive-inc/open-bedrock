import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { RingiRequest } from "@/contexts/ringi/domain/entities/ringi-request.entity"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/repositories/ringi-request.repository"
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

type Context = CompanyContext
type Command = Readonly<{
  requestKey: string
  session: CompanyPersonnelSession
  tokenVersion: number
  approverId: EmployeeId
  title: string
  amount: number
  reason: string
  createdAt: Date
}>

/** 会社の承認規程へ稟議を提出し、同じ内容の再送には作成済みの稟議を返す。 */
export class SubmitRingiProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: Command,
  ): Promise<Readonly<{ request: RingiRequest; replayed: boolean }> | ApplicationError> {
    if (
      !z.string().uuid().safeParse(command.requestKey).success ||
      !z.string().min(1).max(200).safeParse(command.title).success ||
      !z.number().int().positive().safe().safeParse(command.amount).success ||
      !z.string().min(1).max(3000).safeParse(command.reason).success ||
      !Number.isSafeInteger(command.createdAt.getTime())
    )
      return new ValidationError("稟議の入力が不正です", "invalid_ringi")
    if (command.approverId === command.session.employeeId)
      return new ValidationError("自分を提出先に指定できません", "invalid_approver")
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["ringi:submit"],
      now: command.createdAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("稟議を提出する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("提出権限を確認できません", { cause: human })
    const repository = new RingiRequestRepository(this.c)
    const guard = await repository.prepareSubmissionGuard(command.session.accountId)
    if (guard instanceof Error)
      return new UnexpectedError("会社資格を固定できません", { cause: guard })
    const employees = new CompanyEmployeeDirectoryReadAdapter(this.c)
    const linked = await employees.findForAccountIds([command.session.accountId])
    if (linked instanceof Error)
      return new UnexpectedError("申請者を取得できません", { cause: linked })
    const applicant = linked.at(0)?.employee
    if (
      linked.length !== 1 ||
      applicant?.id !== command.session.employeeId ||
      applicant.employment?.status !== "ACTIVE"
    )
      return new ForbiddenError("在籍中の申請者を確認できません", "forbidden")
    const ringi = RingiRequest.create({
      applicantId: applicant.id,
      approverId: command.approverId,
      title: command.title,
      amount: command.amount,
      reason: command.reason,
      createdAt: command.createdAt.toISOString(),
    })
    const existing = await repository.findByRequestKey(command.requestKey)
    if (existing instanceof Error)
      return new UnexpectedError("稟議の再送結果を確認できません", { cause: existing })
    const guards = [...human.assertions, guard]
    if (existing !== null)
      return this.replay({
        existing,
        ringi,
        verifyReceipt: () =>
          repository.readSubmissionReceipt({
            ringiId: existing.id,
            actorAccountId: command.session.accountId,
            guards,
          }),
      })
    const definition = await new SystemD1ProcedureRepository(this.c).find(
      procedureKeySchema.parse("ringi_request"),
    )
    if (definition instanceof Error)
      return new UnexpectedError("稟議の承認規程を取得できません", { cause: definition })
    if (definition === null || definition.completionOperationKey !== "ringi.request.authorize")
      return new ValidationError("稟議の承認規程が設定されていません", "procedure_required")
    const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(definition.decisionPolicyJson))
    if (policy instanceof Error || policy.workflow === null)
      return new ValidationError("稟議の承認規程が不正です", "invalid_procedure")
    const resolved = await new ResolveCompanyProcedureTaskAdapter({
      c: this.c,
      policy,
      payload: ringi.toProposalBody(),
      activatedAt: command.createdAt,
      afterTaskKey: null,
      applicant: {
        employeeId: applicant.id,
        employeeCode: applicant.employeeCode,
        employmentStatus: applicant.employment.status,
        organizationUnitId: applicant.primaryAssignment?.organizationUnitId ?? null,
        organizationUnitCode: applicant.primaryAssignment?.organizationUnitCode ?? null,
        organizationUnitName: applicant.primaryAssignment?.organizationUnitName ?? null,
        positionTitle: applicant.primaryAssignment?.positionTitle ?? null,
      },
      excludedEmployeeIds: new Set([applicant.id]),
    }).resolveCompanyProcedureTask()
    if (resolved instanceof Error || resolved === null)
      return new ValidationError("稟議の承認候補を解決できません", "workflow_unresolvable")
    const candidates = await employees.findForAccountIds(
      resolved.task.candidates.map((candidate) => candidate.accountId),
    )
    if (candidates instanceof Error)
      return new UnexpectedError("提出先を確認できません", { cause: candidates })
    if (!candidates.some((candidate) => candidate.employee.id === command.approverId))
      return new ValidationError(
        "提出先は会社の承認規程の候補から指定してください",
        "invalid_approver",
      )
    const proposal = await ProposalEntity.create({
      id: createProposalId(),
      seriesId: command.requestKey,
      version: 1,
      procedureKey: definition.key,
      procedureRevision: definition.revision,
      body: ringi.toProposalBody(),
      createdByAccountId: command.session.accountId,
      supersedesProposalId: null,
      createdAt: command.createdAt,
    })
    if (proposal instanceof Error)
      return new UnexpectedError("稟議の提案を作成できません", { cause: proposal })
    const workflowCase = SystemCaseEntity.create({
      id: createSystemCaseId(),
      subject: { context: "ringi", kind: "request", id: command.requestKey, version: "1" },
      proposalDigest: proposal.digest,
      createdByAccountId: command.session.accountId,
      status: "pending",
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    })
    if (workflowCase instanceof Error)
      return new UnexpectedError("稟議の案件を作成できません", { cause: workflowCase })
    const firstTask = createSystemDecisionTask({
      task: resolved.task,
      caseId: workflowCase.id,
      createdByAccountId: command.session.accountId,
      proposalDigest: proposal.digest,
    })
    if (firstTask instanceof Error)
      return new UnexpectedError("稟議の判断段階を作成できません", { cause: firstTask })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "ringi.request.submitted",
      targetType: "ringi.request",
      targetId: command.requestKey,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permission: "ringi:submit",
        procedureRevision: definition.revision,
      }),
      beforeJson: null,
      afterJson: JSON.stringify({ proposalDigest: proposal.digest }),
      metadataJson: JSON.stringify({ ...this.c.var.auditContext, actorEmployeeId: applicant.id }),
      occurredAt: command.createdAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("稟議の提出監査を作成できません", { cause: audit })
    const created = await repository.createWithProcedure({
      requestKey: command.requestKey,
      ringi,
      workflow: { proposal, workflowCase, firstTask },
      guards: [...guards, ...resolved.guards],
      audit,
    })
    if (!(created instanceof Error)) return { request: created, replayed: false }
    const concurrent = await repository.findByRequestKey(command.requestKey)
    if (!(concurrent instanceof Error) && concurrent !== null)
      return this.replay({
        existing: concurrent,
        ringi,
        verifyReceipt: () =>
          repository.readSubmissionReceipt({
            ringiId: concurrent.id,
            actorAccountId: command.session.accountId,
            guards,
          }),
      })
    return new ConflictError("保存までに稟議の提出条件が変わりました", "submission_changed", {
      cause: created,
    })
  }

  private async replay(
    input: Readonly<{
      existing: RingiRequest
      ringi: RingiRequest
      verifyReceipt: () => Promise<boolean | Error>
    }>,
  ): Promise<Readonly<{ request: RingiRequest; replayed: true }> | ApplicationError> {
    const expected = CanonicalSystemJsonValue.create(input.ringi.toProposalBody())
    const current = CanonicalSystemJsonValue.create(input.existing.toProposalBody())
    if (
      expected instanceof Error ||
      current instanceof Error ||
      expected.toString() !== current.toString()
    )
      return new ConflictError("再送キーは別の稟議に使用されています", "idempotency_conflict")
    const receipt = await input.verifyReceipt()
    if (receipt instanceof Error)
      return new ForbiddenError("再送結果を取得する資格が変わりました", "forbidden", {
        cause: receipt,
      })
    if (!receipt)
      return new ConflictError("再送キーは別の実行者が使用しています", "idempotency_conflict")
    return { request: input.existing, replayed: true }
  }
}
