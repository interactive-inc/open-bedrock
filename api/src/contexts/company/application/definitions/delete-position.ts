import type { PositionEntity } from "@/contexts/company/domain/entities/position.entity"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { PositionRepository } from "@/contexts/company/infrastructure/repositories/definitions/position.repository"

type Context = Readonly<{ actor: CompanyActorValue; repository: PositionRepository }>

export class DeletePosition {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(id: number): Promise<PositionEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("master:org:write")) return new CompanyForbiddenError()
    const current = await this.c.repository.find({ id })
    if (current instanceof Error) {
      return new CompanyUnexpectedError("failed to find Company position", { cause: current })
    }
    if (current === null)
      return new CompanyNotFoundError("position not found", "position_not_found")
    const usage = await this.c.repository.countCurrentAssignments(current.toProps().name)
    if (usage instanceof Error) {
      return new CompanyUnexpectedError("failed to inspect Company position usage", {
        cause: usage,
      })
    }
    if (usage > 0) return new CompanyConflictError("position is in use", "position_in_use")
    const deleted = await this.c.repository.delete(current)
    if (deleted instanceof Error) {
      return new CompanyUnexpectedError("failed to delete Company position", { cause: deleted })
    }
    return deleted ? current : new CompanyNotFoundError("position not found", "position_not_found")
  }
}
