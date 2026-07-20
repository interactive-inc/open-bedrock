import type { Session } from "@/lib/auth/session"
import type { Regulation } from "@/domain/regulation/regulation.entity"
import { RegulationVersion } from "@/domain/regulation/regulation-version.entity"
import type { Context } from "@/env"
import { RegulationRepository } from "@/infrastructure/regulation/regulation-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  code: string
  bodyMd: string
  effectiveOn: string
  note: string | null
  createdAt: string
}

export type Added = {
  regulation: Regulation
  version: RegulationVersion
}

/**
 * 権限を確認し、既存規程へ次の連番の改定版を追加する。
 */
export class AddRegulationVersion {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Added | ApplicationError> {
    const regulationRepository = new RegulationRepository(this.c)

    if (command.session.hasPermission("regulation:manage") === false) {
      return new ForbiddenError("cannot manage regulations", "forbidden")
    }

    const regulation = await regulationRepository.findByCode(command.code)

    if (regulation instanceof Error) {
      return new UnexpectedError("failed to find regulation", { cause: regulation })
    }

    if (regulation === null || regulation.id === null) {
      return new NotFoundError("regulation not found", "regulation_not_found")
    }

    const versions = await regulationRepository.listVersions(regulation.id)

    if (versions instanceof Error) {
      return new UnexpectedError("failed to load regulation versions", { cause: versions })
    }

    // listVersions は version 降順なので先頭が最新。空なら 1 から始める。
    const nextVersion = (versions.at(0)?.version ?? 0) + 1

    const created = await regulationRepository.createVersion(
      RegulationVersion.create({
        regulationId: regulation.id,
        version: nextVersion,
        bodyMd: command.bodyMd,
        effectiveOn: command.effectiveOn,
        note: command.note,
        createdAt: command.createdAt,
      }),
    )

    // findByCode と insert の間に並行で同一 version が入ると UNIQUE 違反になる（TOCTOU）。
    if (created instanceof UniqueConstraintError) {
      return new ConflictError("regulation version already exists", "regulation_version_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create regulation version", { cause: created })
    }

    return { regulation: regulation, version: created }
  }
}
