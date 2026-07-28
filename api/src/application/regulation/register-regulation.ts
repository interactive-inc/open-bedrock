import type { Session } from "@/lib/auth/session"
import { Regulation } from "@/domain/regulation/regulation.entity"
import { RegulationVersion } from "@/domain/regulation/regulation-version.entity"
import type { Context } from "@/env"
import { RegulationRepository } from "@/infrastructure/regulation/regulation-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  code: string
  title: string
  category: string | null
  bodyMd: string
  effectiveOn: string
  note: string | null
  createdAt: string
}

export type Registered = {
  regulation: Regulation
  version: RegulationVersion
}

/**
 * 権限と重複コードを確認し、規程を version 1 の初版付きで新規登録する。
 */
export class RegisterRegulation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Registered | ApplicationError> {
    const regulationRepository = new RegulationRepository(this.c)

    if (command.session.hasPermission("regulation:manage") === false) {
      return new ForbiddenError("cannot manage regulations", "forbidden")
    }

    const existing = await regulationRepository.findByCode(command.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find regulation", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("regulation code already exists", "regulation_code_conflict")
    }

    const created = await regulationRepository.create(
      Regulation.create({
        code: command.code,
        title: command.title,
        category: command.category,
        createdAt: command.createdAt,
      }),
    )

    if (created instanceof UniqueConstraintError) {
      return new ConflictError("regulation code already exists", "regulation_code_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create regulation", { cause: created })
    }

    if (created.id === null) {
      return new UnexpectedError("regulation id missing after insert")
    }

    const versionCreated = await regulationRepository.createVersion(
      RegulationVersion.create({
        regulationId: created.id,
        version: 1,
        bodyMd: command.bodyMd,
        effectiveOn: command.effectiveOn,
        note: command.note,
        createdAt: command.createdAt,
      }),
    )

    if (versionCreated instanceof Error) {
      return new UnexpectedError("failed to create regulation version", { cause: versionCreated })
    }

    return { regulation: created, version: versionCreated }
  }
}
