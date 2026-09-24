import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { CareerOrganizationUnitAdapter } from "@/contexts/career/infrastructure/adapters/career-organization-unit.adapter"
import { isCareerRecordSourceFrozenError } from "@/contexts/career/infrastructure/repositories/lib/is-career-record-source-frozen-error"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnavailableError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/repositories/career-posting.repository"

export type Command = {
  session: CompanySessionValue
  postingId: number
  title: string
  organizationUnitId: OrganizationUnitId | null
  requiredSkills: string | null
  status?: "open" | "closed"
}

/**
 * 管理ロールが社内公募の内容と状態を変更する。
 * 募集部署を別の組織単位へ変えるときは会社営業日に有効な単位だけを受け付ける。
 * 設定済みの単位を保つ変更は、その単位が後から廃止されていても受け付ける。
 */
export class UpdateCareerPosting {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<CareerPosting | ApplicationError> {
    const postingRepository = new CareerPostingRepository(this.c)

    if (command.session.hasPermission("career_posting:manage") === false) {
      return new ForbiddenError("cannot manage career postings", "forbidden")
    }

    const current = await postingRepository.findById(command.postingId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find career posting", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("career posting not found", "posting_not_found")
    }

    if (
      command.organizationUnitId !== null &&
      command.organizationUnitId !== current.organizationUnitId
    ) {
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

    const updated = await postingRepository.update(
      current.withDetails({
        title: command.title,
        organizationUnitId: command.organizationUnitId,
        requiredSkills: command.requiredSkills,
        status: command.status ?? current.status,
      }),
    )

    if (updated instanceof Error) {
      if (isCareerRecordSourceFrozenError(updated)) {
        return new ConflictError("career writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      }
      return new UnexpectedError("failed to update career posting", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("career posting not found", "posting_not_found")
    }

    return updated
  }
}
