import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import {
  zApplicationWorkflow,
  type ApplicationWorkflow,
} from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
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

/** 休暇に適用する会社の承認規程を版付きで公開する。 */
export class PublishLeaveProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async run(command: Command): Promise<ProcedureDefinitionEntity | ApplicationError> {
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
          (selector) => selector.type === "role" || selector.type === "responsibility",
        ),
      )
    )
      return new ValidationError(
        "会社上の責務・役職・合議体を指定してください",
        "invalid_authority",
      )
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["leave:procedure:manage"],
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
      key: "leave_request",
      revision: command.expectedRevision + 1,
      title: "休暇",
      category: "leave",
      description: null,
      inputSchema: {
        fields: [
          { key: "employeeId", type: "text", label: "従業員", required: true },
          { key: "leaveType", type: "text", label: "休暇種別", required: true },
          { key: "startDate", type: "date", label: "開始日", required: true },
          { key: "endDate", type: "date", label: "終了日", required: true },
          { key: "days", type: "number", label: "日数", required: true },
          { key: "unit", type: "text", label: "取得単位", required: true },
          { key: "hours", type: "number", label: "時間数", required: false },
          { key: "consumedDays", type: "number", label: "消費日数", required: true },
          { key: "reason", type: "textarea", label: "理由", required: false },
        ],
      },
      decisionPolicy: policy,
      completionOperationKey: "leave.request.authorize",
      createdByAccountId: command.session.accountId,
      createdAt: command.publishedAt,
    })
    if (definition instanceof Error)
      return new UnexpectedError("承認規程を作成できません", { cause: definition })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "leave.procedure.published",
      targetType: "leave.procedure",
      targetId: definition.key,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ permission: "leave:procedure:manage" }),
      beforeJson: JSON.stringify({ revision: command.expectedRevision }),
      afterJson: JSON.stringify({ revision: definition.revision, decisionPolicy: policy }),
      metadataJson: JSON.stringify(this.c.var.auditContext),
      occurredAt: command.publishedAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("規程の監査を作成できません", { cause: audit })
    const saved = await new SystemD1ProcedureRepository({
      ...this.c,
      publishGuards: human.assertions,
      publishEffects: new SystemAuditEventRepository(this.c).prepareAppend(audit),
    }).publish(definition, command.expectedRevision)
    if (saved === "revision_conflict")
      return new ConflictError("承認規程または設定権限が変更されました", "revision_conflict")
    if (saved instanceof Error)
      return new UnexpectedError("承認規程を保存できません", { cause: saved })
    return definition
  }
}
