import type { Session } from "@/lib/auth/session"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/contexts/administration/infrastructure/repositories/organization/org-department.repository"
import type { OrgDepartment } from "@/contexts/administration/domain/entities/org-department.entity"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

export type Command = {
  session: Session
  code: string
}

export type Deleted = { reason: "archived" }

/**
 * 部署は物理削除せず、現在・未来の所属と責任がない場合だけアーカイブする。
 * 過去の人事履歴と参照整合性は保持する。
 */
export class DeleteOrgDepartment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    if (command.session.hasPermission("org:manage") === false) {
      return new ForbiddenError("cannot manage org", "forbidden")
    }

    const current: OrgDepartment | null | Error = await departmentRepository.findByCode(
      command.code,
    )

    if (current instanceof Error) {
      return new UnexpectedError("failed to find department", {
        cause: current,
      })
    }

    if (current === null) {
      return new NotFoundError("department not found", "department_not_found")
    }

    const businessDate = resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      return new UnexpectedError("failed to resolve company business date", {
        cause: businessDate,
      })
    }
    const archivedAt = Math.floor(Date.parse(this.c.env.NOW ?? new Date().toISOString()) / 1_000)
    const archived = await departmentRepository.archive(current, {
      archivedAt,
      archivedByAccountId: command.session.accountId,
      businessDate,
    })
    if (archived === "in_use") {
      return new ConflictError(
        "department has current or future organization facts or child departments",
        "department_in_use",
      )
    }
    return archived instanceof Error
      ? new UnexpectedError("failed to archive department", { cause: archived })
      : { reason: "archived" }
  }
}
