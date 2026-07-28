import type { Session } from "@/lib/auth/session"
import type { Document } from "@/domain/document/document.entity"
import type { Context } from "@/env"
import { DocumentRepository } from "@/infrastructure/document/document-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  documentId: number
  title: string
  category: string | null
  location: string
  partnerCode: string | null
  expiresOn: string | null
  note: string | null
}

/**
 * 権限を確認し、文書台帳のメタデータを更新する。
 */
export class UpdateDocument {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Document | ApplicationError> {
    const documentRepository = new DocumentRepository(this.c)

    if (command.session.hasPermission("document:manage") === false) {
      return new ForbiddenError("cannot manage documents", "forbidden")
    }

    const current = await documentRepository.findById(command.documentId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find document", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("document not found", "document_not_found")
    }

    const result = await documentRepository.update(
      current.withDetails({
        title: command.title,
        category: command.category,
        location: command.location,
        partnerCode: command.partnerCode,
        expiresOn: command.expiresOn,
        note: command.note,
      }),
    )

    if (result instanceof Error) {
      return new UnexpectedError("failed to update document", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("document not found", "document_not_found")
    }

    return result
  }
}
