import { PrepareExpenseApprovalScopeAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-approval-scope.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { zOrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { Expense } from "@/contexts/expense/domain/entities/expense.entity"
import {
  expenseCategorySchema,
  type ExpenseCategory,
} from "@/contexts/expense/domain/definitions/expense.definition"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
import { PrepareAttachmentEvidenceAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-evidence.adapter"
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
import { isoDate } from "@/lib/validation/iso-date.schema"
import {
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  ValidationError,
  type ApplicationError,
} from "@/lib/errors"
import { z } from "zod"

type Context = CompanyContext
type Command = Readonly<{
  requestKey: string
  existingExpenseId?: number | null
  previousExpenseId?: number | null
  session: CompanyPersonnelSession
  tokenVersion: number
  category: ExpenseCategory
  amount: number
  spentAt: string
  note: string | null
  attachmentIds: ReadonlyArray<string>
  createdAt: Date
}>
type Result = Readonly<{ request: Expense; replayed: boolean }>

/** 経費の内容・添付と会社の判断対象を同時に保存し、同じ提出の再送へ既存結果を返す。 */
export class SubmitExpenseProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Result | ApplicationError> {
    if (
      !z.string().uuid().safeParse(command.requestKey).success ||
      !expenseCategorySchema.safeParse(command.category).success ||
      !z.number().int().positive().safe().safeParse(command.amount).success ||
      !isoDate.safeParse(command.spentAt).success ||
      !z.string().max(3000).nullable().safeParse(command.note).success ||
      !Number.isSafeInteger(command.createdAt.getTime()) ||
      !z.array(z.string().min(1).max(64)).max(10).safeParse(command.attachmentIds).success ||
      new Set(command.attachmentIds).size !== command.attachmentIds.length ||
      (command.existingExpenseId != null && command.previousExpenseId != null)
    )
      return new ValidationError("経費の入力が不正です", "invalid_expense")
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["expense:submit"],
      now: command.createdAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("経費を提出する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("提出権限を確認できません", { cause: human })
    const repository = new ExpenseProcedureRepository(this.c)
    const companyGuard = await repository.prepareSubmissionGuard(command.session.accountId)
    if (companyGuard instanceof Error)
      return new UnexpectedError("会社資格を固定できません", { cause: companyGuard })
    const people = await new CompanyEmployeeDirectoryReadAdapter({
      ...this.c,
      env: { ...this.c.env, NOW: command.createdAt.toISOString() },
    }).findForAccountIds([command.session.accountId])
    if (people instanceof Error)
      return new UnexpectedError("申請者を確認できません", { cause: people })
    const applicant = people.at(0)?.employee
    if (
      people.length !== 1 ||
      applicant?.id !== command.session.employeeId ||
      applicant.employment?.status !== "ACTIVE"
    )
      return new ForbiddenError("在籍中の申請者を確認できません", "forbidden")
    const existing = await repository.findByRequestKey(command.requestKey)
    const original =
      command.existingExpenseId == null
        ? null
        : await repository.findById(command.existingExpenseId)
    if (existing instanceof Error || original instanceof Error)
      return new UnexpectedError("既存経費を確認できません")
    if (command.existingExpenseId != null && original === null)
      return new ValidationError("既存経費が見つかりません", "expense_not_found")
    const organizationUnitId = zOrganizationUnitId.safeParse(
      original?.organizationUnitId ??
        existing?.organizationUnitId ??
        applicant.primaryAssignment?.organizationUnitId,
    )
    if (!organizationUnitId.success)
      return new ValidationError("主務の組織所属が必要です", "organization_assignment_required")
    const requested = Expense.create({
      employeeId: applicant.id,
      organizationUnitId: organizationUnitId.data,
      category: command.category,
      amount: command.amount,
      spentAt: command.spentAt,
      note: command.note,
      createdAt: command.createdAt.toISOString(),
    })
    if (
      original !== null &&
      JSON.stringify(original.toProposalBody([])) !== JSON.stringify(requested.toProposalBody([]))
    )
      return new ConflictError("確認した既存経費が変わっています", "legacy_expense_changed")
    const expense = original ?? requested
    const guards = [...human.assertions, companyGuard]
    if (existing !== null)
      return this.replay({
        command,
        existing,
        expense,
        verifyReceipt: () =>
          repository.readSubmissionReceipt({
            expenseId: existing.id,
            existingExpenseId: command.existingExpenseId ?? null,
            previousExpenseId: command.previousExpenseId ?? null,
            actorAccountId: command.session.accountId,
            guards,
          }),
      })
    const scope = await new PrepareExpenseApprovalScopeAdapter(this.c).prepare({
      organizationUnitId: expense.organizationUnitId,
      at: command.createdAt,
    })
    if (scope instanceof Error)
      return new ConflictError("負担組織を確認できません", "organization_scope_changed", {
        cause: scope,
      })
    if (original !== null && original.status !== "pending")
      return new ConflictError("決定済みの経費は提出できません", "already_decided")
    const reusedFrom = command.existingExpenseId ?? command.previousExpenseId
    const linkedIds = reusedFrom == null ? [] : await repository.readAttachmentIds(reusedFrom)
    if (linkedIds instanceof Error)
      return new UnexpectedError("元の添付を取得できません", { cause: linkedIds })
    if (
      original !== null &&
      JSON.stringify([...linkedIds].sort()) !== JSON.stringify([...command.attachmentIds].sort())
    )
      return new ConflictError("既存経費の添付が変わっています", "legacy_expense_changed")
    const evidence = await new PrepareAttachmentEvidenceAdapter(this.c).prepare({
      attachmentIds: command.attachmentIds,
      ownerAccountId: command.session.accountId,
      linkedAttachmentIds: new Set(linkedIds),
      at: command.createdAt,
    })
    if (evidence instanceof Error)
      return new ValidationError(evidence.message, "attachment_unavailable")
    const definition = await new SystemD1ProcedureRepository(this.c).find(
      procedureKeySchema.parse("expense_request"),
    )
    if (definition instanceof Error)
      return new UnexpectedError("経費規程を取得できません", { cause: definition })
    if (definition === null || definition.completionOperationKey !== "expense.request.authorize")
      return new ValidationError("経費の承認規程が設定されていません", "procedure_required")
    const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(definition.decisionPolicyJson))
    if (policy instanceof Error || policy.workflow === null)
      return new ValidationError("承認規程が不正です", "invalid_procedure")
    const payload = expense.toProposalBody(evidence.evidence)
    const resolved = await new ResolveCompanyProcedureTaskAdapter({
      c: this.c,
      policy,
      payload,
      activatedAt: command.createdAt,
      afterTaskKey: null,
      targetDepartmentCode: scope.targetDepartmentCode,
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
      return new ValidationError("経費の判断候補を解決できません", "workflow_unresolvable")
    const proposal = await ProposalEntity.create({
      id: createProposalId(),
      seriesId: command.requestKey,
      version: 1,
      procedureKey: definition.key,
      procedureRevision: definition.revision,
      body: payload,
      createdByAccountId: command.session.accountId,
      supersedesProposalId: null,
      createdAt: command.createdAt,
    })
    if (proposal instanceof Error)
      return new UnexpectedError("経費の提案を作成できません", { cause: proposal })
    const workflowCase = SystemCaseEntity.create({
      id: createSystemCaseId(),
      subject: { context: "expense", kind: "request", id: command.requestKey, version: "1" },
      proposalDigest: proposal.digest,
      createdByAccountId: command.session.accountId,
      status: "pending",
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    })
    if (workflowCase instanceof Error)
      return new UnexpectedError("経費案件を作成できません", { cause: workflowCase })
    const firstTask = createSystemDecisionTask({
      task: resolved.task,
      caseId: workflowCase.id,
      createdByAccountId: command.session.accountId,
      proposalDigest: proposal.digest,
    })
    if (firstTask instanceof Error)
      return new UnexpectedError("判断段階を作成できません", { cause: firstTask })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "expense.request.submitted",
      targetType: "expense.request",
      targetId: command.requestKey,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permission: "expense:submit",
        procedureRevision: definition.revision,
      }),
      beforeJson: null,
      afterJson: JSON.stringify({
        proposalDigest: proposal.digest,
        existingExpenseId: command.existingExpenseId ?? null,
        previousExpenseId: command.previousExpenseId ?? null,
      }),
      metadataJson: JSON.stringify(this.c.var.auditContext),
      occurredAt: command.createdAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("提出監査を作成できません", { cause: audit })
    const created = await repository.createWithProcedure({
      requestKey: command.requestKey,
      existingExpenseId: command.existingExpenseId ?? null,
      previousExpenseId: command.previousExpenseId ?? null,
      expense,
      attachments: evidence.evidence,
      attachmentEffects: evidence.effects,
      workflow: { proposal, workflowCase, firstTask },
      guards: [...guards, scope.guard, ...evidence.guards, ...resolved.guards],
      audit,
    })
    if (!(created instanceof Error)) return { request: created, replayed: false }
    const concurrent = await repository.findByRequestKey(command.requestKey)
    if (!(concurrent instanceof Error) && concurrent !== null)
      return this.replay({
        command,
        existing: concurrent,
        expense,
        verifyReceipt: () =>
          repository.readSubmissionReceipt({
            expenseId: concurrent.id,
            existingExpenseId: command.existingExpenseId ?? null,
            previousExpenseId: command.previousExpenseId ?? null,
            actorAccountId: command.session.accountId,
            guards,
          }),
      })
    return new ConflictError("保存までに経費の提出条件が変わりました", "submission_changed", {
      cause: created,
    })
  }

  private async replay(
    input: Readonly<{
      command: Command
      existing: Expense
      expense: Expense
      verifyReceipt: () => Promise<boolean | Error>
    }>,
  ): Promise<Result | ApplicationError> {
    const binding =
      input.existing.id === null
        ? null
        : await new ExpenseProcedureRepository(this.c).findProcedure(input.existing.id)
    const expected = CanonicalSystemJsonValue.create(input.expense.toProposalBody([]))
    const current = CanonicalSystemJsonValue.create(input.existing.toProposalBody([]))
    if (
      binding instanceof Error ||
      binding === null ||
      expected instanceof Error ||
      current instanceof Error ||
      expected.toString() !== current.toString() ||
      binding.previousExpenseId !== (input.command.previousExpenseId ?? null) ||
      (input.command.existingExpenseId != null &&
        input.command.existingExpenseId !== input.existing.id) ||
      JSON.stringify(binding.attachments.map((attachment) => attachment.id).sort()) !==
        JSON.stringify([...input.command.attachmentIds].sort())
    )
      return new ConflictError("再送キーは別の経費に使用されています", "idempotency_conflict")
    const receipt = await input.verifyReceipt()
    if (receipt !== true)
      return new ForbiddenError("再送結果の取得資格を確認できません", "forbidden")
    return { request: input.existing, replayed: true }
  }
}
