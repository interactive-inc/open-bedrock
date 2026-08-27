import { PositionEntity } from "@/contexts/company/domain/entities/position.entity"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyUniqueConstraintError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { PositionRepository } from "@/contexts/company/infrastructure/repositories/definitions/position.repository"

type Context = Readonly<{ actor: CompanyActorValue; repository: PositionRepository }>

export class UpdatePosition {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: {
    id: number
    details: Pick<ReturnType<PositionEntity["toProps"]>, "code" | "name" | "rank" | "description">
  }): Promise<PositionEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("master:org:write")) return new CompanyForbiddenError()
    const current = await this.c.repository.findById(input.id)
    if (current instanceof Error) {
      return new CompanyUnexpectedError("failed to find Company position", { cause: current })
    }
    if (current === null)
      return new CompanyNotFoundError("position not found", "position_not_found")
    const updated = await this.c.repository.update(current.withDetails(input.details))
    if (updated instanceof CompanyUniqueConstraintError) {
      return new CompanyConflictError("position code already exists", "position_code_conflict")
    }
    if (updated instanceof Error) {
      return new CompanyUnexpectedError("failed to update Company position", { cause: updated })
    }
    return updated ?? new CompanyNotFoundError("position not found", "position_not_found")
  }
}
