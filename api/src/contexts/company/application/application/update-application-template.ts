import type { Session } from "@/contexts/company/domain/iam/session"
import type { ApplicationTemplate } from "@/contexts/company/domain/application/application-template.entity"
import type { Context } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError, UnprocessableError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationTemplateRepository } from "@/contexts/company/infrastructure/application/application-template-repository"
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
 * 管理権限を持つ者が申請テンプレートの内容を変更する。code は変更しない。
 */
export class UpdateApplicationTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ApplicationTemplate | ApplicationError> {
    const templateRepository = new ApplicationTemplateRepository(this.c)

    if (command.session.hasPermission("application_template:manage") === false) {
      return new ForbiddenError("cannot manage application templates", "forbidden")
    }

    const current = await templateRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    if (
      current.systemBinding !== null &&
      (command.category !== current.category ||
        stableJson(command.schemaJson) !== stableJson(current.schemaJson) ||
        stableJson(command.approverRoles) !== stableJson(current.approverRoles))
    ) {
      return new UnprocessableError(
        "system template structure cannot be changed",
        "system_template_structure_locked",
      )
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

    const updated = await templateRepository.update(
      current.withDetails({
        name: command.name,
        category: command.category,
        description: command.description,
        schemaJson: command.schemaJson,
        approverRoles: command.approverRoles,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update application template", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    return updated
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? "undefined"
}
