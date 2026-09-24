import { ExpenseSystemWorkflowAdapter } from "@/contexts/expense/infrastructure/adapters/expense-system-workflow.adapter"
import { PrepareExpenseWriteGuardAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-write-guard.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import {
  zApplicationWorkflow,
  type ApplicationWorkflow,
} from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ExpenseHumanOperationAuthorizationAdapter } from "@/contexts/expense/infrastructure/adapters/expense-human-operation-authorization.adapter"
import { ExpenseAuditEventAdapter } from "@/contexts/expense/infrastructure/adapters/expense-audit-event.adapter"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import {
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  ValidationError,
  type ApplicationError,
} from "@/lib/errors"

type Context = CompanyContext
type Command = Readonly<{
  expectedRevision: number
  workflow: ApplicationWorkflow
  session: CompanyPersonnelSession
  tokenVersion: number
  publishedAt: Date
}>

/** 経費に適用する会社の承認規程を版付きで公開する。 */
export class PublishExpenseProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async run(command: Command): Promise<ProcedureDefinitionEntity | ApplicationError> {
    const result = await this.runWithWriteGuards(command)
    return new PrepareExpenseWriteGuardAdapter(this.c).failure(result) ?? result
  }

  private async runWithWriteGuards(
    command: Command,
  ): Promise<ProcedureDefinitionEntity | ApplicationError> {
    const workflow = zApplicationWorkflow.safeParse(command.workflow)
    if (
      !workflow.success ||
      !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 0
    )
      return new ValidationError("承認規程の入力が不正です", "invalid_procedure")
    if (
      workflow.data.steps.some((step) =>
        [...step.approvers, ...step.escalation_approvers].some(
          (selector) => selector.type === "role",
        ),
      )
    )
      return new ValidationError(
        "会社上の責務・役職・合議体を指定してください",
        "invalid_authority",
      )
    const writeGuard = new PrepareExpenseWriteGuardAdapter(this.c).prepare()
    const human = await new ExpenseHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["expense:procedure:manage"],
      now: command.publishedAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("承認規程を設定する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("規程設定の権限を確認できません", { cause: human })
    const policy = createCompanyProcedureDecisionPolicy({
      approverRoles: [],
      workflow: workflow.data,
      workflowRevision: command.expectedRevision + 1,
    })
    if (policy instanceof Error)
      return new ValidationError("承認規程が不正です", "invalid_procedure")
    const definition = ProcedureDefinitionEntity.create({
      key: "expense_request",
      revision: command.expectedRevision + 1,
      title: "経費",
      category: "expense",
      description: null,
      inputSchema: {
        fields: [
          { key: "category", type: "text", label: "種別", required: true },
          { key: "amount", type: "number", label: "金額", required: true },
          { key: "spentAt", type: "date", label: "利用日", required: true },
          { key: "note", type: "textarea", label: "備考", required: false },
        ],
      },
      decisionPolicy: policy,
      completionOperationKey: "expense.request.authorize",
      createdByAccountId: command.session.accountId,
      createdAt: command.publishedAt,
    })
    if (definition instanceof Error)
      return new UnexpectedError("承認規程を作成できません", { cause: definition })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "expense.procedure.published",
      targetType: "expense.procedure",
      targetId: definition.key,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ permission: "expense:procedure:manage" }),
      beforeJson: JSON.stringify({ revision: command.expectedRevision }),
      afterJson: JSON.stringify({ revision: definition.revision, decisionPolicy: policy }),
      metadataJson: JSON.stringify(this.c.var.auditContext),
      occurredAt: command.publishedAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("規程の監査を作成できません", { cause: audit })
    const saved = await new ExpenseSystemWorkflowAdapter({
      ...this.c,
      publishGuards: [...human.assertions, writeGuard],
      publishEffects: new ExpenseAuditEventAdapter(this.c).prepareAppend(audit),
    })
      .procedures()
      .publish(definition, command.expectedRevision)
    if (saved === "revision_conflict")
      return new ConflictError("承認規程または設定権限が変更されました", "revision_conflict")
    if (saved instanceof Error)
      return new UnexpectedError("承認規程を保存できません", { cause: saved })
    return definition
  }
}
