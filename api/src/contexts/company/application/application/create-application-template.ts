import type { Session } from "@/contexts/company/domain/iam/session"
import { ApplicationTemplate } from "@/contexts/company/domain/application/application-template.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, UnexpectedError, UnprocessableError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationTemplateRepository } from "@/contexts/company/infrastructure/application/application-template-repository"
import { UniqueConstraintError } from "@/contexts/company/infrastructure/shared/unique-constraint-error"
import { findUnknownApproverRoles } from "@/contexts/company/application/application/validate-approver-roles"

export type Command = {
  session: Session
  code: string
  name: string
  category: string
  description: string | null
  schemaJson: unknown
  approverRoles: ReadonlyArray<string>
}

/**
 * 管理権限を持つ者が新しい申請テンプレートを作成する。
 */
export class CreateApplicationTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ApplicationTemplate | ApplicationError> {
    const templateRepository = new ApplicationTemplateRepository(this.c)

    if (command.session.hasPermission("application_template:manage") === false) {
      return new ForbiddenError("cannot manage application templates", "forbidden")
    }

    const unknownApproverRoles = await findUnknownApproverRoles(this.c, command.approverRoles)
    if (unknownApproverRoles instanceof Error) {
      return new UnexpectedError("failed to validate approver roles", {
        cause: unknownApproverRoles,
      })
    }
    if (unknownApproverRoles.length > 0) {
      return new UnprocessableError("unknown approver role", "unknown_approver_role")
    }

    const existing = await templateRepository.findByCode(command.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("template code already exists", "template_code_conflict")
    }

    const template = ApplicationTemplate.create({
      code: command.code,
      name: command.name,
      category: command.category,
      description: command.description,
      schemaJson: command.schemaJson,
      approverRoles: command.approverRoles,
    })

    const result = await templateRepository.create(template)

    // code の重複は事前チェック済みだが、レース時に DB 制約で捕捉される。
    if (result instanceof UniqueConstraintError) {
      return new ConflictError("template code already exists", "template_code_conflict")
    }

    if (result instanceof Error) {
      return new UnexpectedError("failed to create application template", { cause: result })
    }

    return result
  }
}
