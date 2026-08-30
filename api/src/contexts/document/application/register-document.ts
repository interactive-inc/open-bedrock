import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { Document } from "@/contexts/document/domain/entities/document.entity"
import type { Context } from "@/env"
import { DocumentRepository } from "@/contexts/document/infrastructure/repositories/document.repository"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: CompanySessionValue
  title: string
  category: string | null
  location: string
  partnerCode: string | null
  expiresOn: string | null
  note: string | null
  createdAt: string
}

/**
 * 権限を確認し、文書台帳へ新しい文書メタデータを登録する。
 */
export class RegisterDocument {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Document | ApplicationError> {
    const documentRepository = new DocumentRepository(this.c)

    if (command.session.hasPermission("document:manage") === false) {
      return new ForbiddenError("cannot manage documents", "forbidden")
    }

    const created = await documentRepository.create(
      Document.create({
        title: command.title,
        category: command.category,
        location: command.location,
        partnerCode: command.partnerCode,
        expiresOn: command.expiresOn,
        note: command.note,
        createdAt: command.createdAt,
      }),
    )

    if (created instanceof Error) {
      return new UnexpectedError("failed to create document", { cause: created })
    }

    return created
  }
}
