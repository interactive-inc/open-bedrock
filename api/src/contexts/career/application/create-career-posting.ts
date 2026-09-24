import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { CareerOrganizationUnitAdapter } from "@/contexts/career/infrastructure/adapters/career-organization-unit.adapter"
import { isCareerRecordSourceFrozenError } from "@/contexts/career/infrastructure/repositories/lib/is-career-record-source-frozen-error"
import {
  ConflictError,
  ForbiddenError,
  UnavailableError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/repositories/career-posting.repository"

export type Command = {
  session: CompanySessionValue
  title: string
  organizationUnitId: OrganizationUnitId | null
  requiredSkills: string | null
  status: "open" | "closed"
}

/**
 * 管理ロールが新しい社内公募を作成する。id は DB が採番する。
 * 募集部署は会社営業日に有効な組織単位だけを受け付け、組織を読めないときは作成しない。
 */
export class CreateCareerPosting {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<CareerPosting | ApplicationError> {
    const postingRepository = new CareerPostingRepository(this.c)

    if (command.session.hasPermission("career_posting:manage") === false) {
      return new ForbiddenError("cannot manage career postings", "forbidden")
    }

    if (command.organizationUnitId !== null) {
      const units = await new CareerOrganizationUnitAdapter(this.c).load()

      if (units instanceof Error) {
        return new UnavailableError(
          "failed to resolve organization unit",
          "organization_unavailable",
          { cause: units },
        )
      }

      if (!units.isSelectable(command.organizationUnitId)) {
        return new UnprocessableError(
          "organization unit is not selectable",
          "organization_unit_not_selectable",
        )
      }
    }

    const careerPosting = CareerPosting.create({
      title: command.title,
      organizationUnitId: command.organizationUnitId,
      requiredSkills: command.requiredSkills,
      status: command.status,
    })

    const created = await postingRepository.create(careerPosting)

    if (created instanceof Error) {
      if (isCareerRecordSourceFrozenError(created)) {
        return new ConflictError("career writes are frozen", "record_source_frozen", {
          cause: created,
        })
      }
      return new UnexpectedError("failed to create career posting", { cause: created })
    }

    return created
  }
}
