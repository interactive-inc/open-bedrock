import { GradeAwardArchiveEntity } from "@/contexts/company/domain/entities/grade-award-archive.entity"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { GradeAwardArchiveRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade-award-archive.repository"
import type { SystemRequestAudit } from "@system/configuration/system-context"

type Context = Readonly<{
  actor: CompanyActorValue
  repository: GradeAwardArchiveRepository
  now: Date
  requestAudit: SystemRequestAudit
}>
type Input = Omit<GradeAwardArchiveEntity["props"], "actorAccountId" | "recordedAt">

/** 確認した等級付与の原記録を保全し、過去の判断資格や雇用期間を補完しない。 */
export class ApplyGradeAwardArchive {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: Input) {
    if (
      !this.c.actor.canAccessOrganization("organization:default") ||
      !this.c.actor.hasCapability("company:admin")
    )
      return new CompanyForbiddenError()
    const command = GradeAwardArchiveEntity.create({
      ...input,
      actorAccountId: this.c.actor.accountId,
      recordedAt: this.c.now.getTime(),
    })
    if (command instanceof Error) return command
    return this.c.repository.archive(command, {
      authorizationJson: JSON.stringify({
        organizationId: "organization:default",
        capability: "company:admin",
        actorAccountId: this.c.actor.accountId,
        actorEmployeeId: this.c.actor.employeeId,
        purpose: "preserve_original_records",
      }),
      metadataJson: JSON.stringify(this.c.requestAudit),
    })
  }
}
