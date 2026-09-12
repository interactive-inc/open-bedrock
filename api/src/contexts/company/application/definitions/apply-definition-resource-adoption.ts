import {
  DefinitionResourceAdoptionEntity,
  type DefinitionResourceAdoptionInput,
} from "@/contexts/company/domain/entities/definition-resource-adoption.entity"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { DefinitionResourceAdoptionRepository } from "@/contexts/company/infrastructure/repositories/definitions/definition-resource-adoption.repository"

type Context = Readonly<{
  actor: CompanyActorValue
  repository: DefinitionResourceAdoptionRepository
  now: Date
}>

/** 確認した旧等級・役職を、元の証跡とともに公開履歴へ接続する。 */
export class ApplyDefinitionResourceAdoption {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: DefinitionResourceAdoptionInput) {
    if (
      !this.c.actor.canAccessOrganization("organization:default") ||
      !this.c.actor.hasCapability("company:admin")
    )
      return new CompanyForbiddenError()
    const command = DefinitionResourceAdoptionEntity.create({
      ...input,
      actorAccountId: this.c.actor.accountId,
      recordedAt: this.c.now.getTime(),
    })
    if (command instanceof Error) return command
    return this.c.repository.adopt(command)
  }
}
