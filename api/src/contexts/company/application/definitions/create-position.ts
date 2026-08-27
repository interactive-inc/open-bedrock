import { PositionEntity } from "@/contexts/company/domain/entities/position.entity"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyOperationError,
  CompanyUniqueConstraintError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { PositionRepository } from "@/contexts/company/infrastructure/repositories/definitions/position.repository"

type Context = Readonly<{ actor: CompanyActorValue; repository: PositionRepository }>

export class CreatePosition {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: Omit<ReturnType<PositionEntity["toProps"]>, "id">,
  ): Promise<PositionEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("master:org:write")) return new CompanyForbiddenError()
    const created = await this.c.repository.create(PositionEntity.create(input))
    if (created instanceof CompanyUniqueConstraintError) {
      return new CompanyConflictError("position code already exists", "position_code_conflict")
    }
    return created instanceof Error
      ? new CompanyUnexpectedError("failed to create Company position", { cause: created })
      : created
  }
}
