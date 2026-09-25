import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { prepareSystemAttachmentContentReadGuard } from "@system/interface/operations/prepare-system-attachment-content-read-guard"
import { openSystemAttachments } from "@system/interface/operations/open-system-attachments"
import { PrepareExpenseRecordReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-record-read.adapter"
import { NotFoundError, UnexpectedError, UnprocessableError } from "@/lib/errors"

type Context = CompanyContext

/** 経費の共通閲覧資格に、判断時の添付との一致と復号対象の検査を加える。 */
export class PrepareExpenseAttachmentReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      expenseId: string
      attachmentId: string
      authentication: SystemReadAuthentication
      session: CompanyPersonnelSession
      at: Date
    }>,
  ) {
    const prepared = await new PrepareExpenseRecordReadAdapter(this.c).prepare(input)
    if (prepared instanceof NotFoundError)
      return new NotFoundError("添付が見つかりません", "attachment_not_found")
    if (prepared instanceof Error) return prepared
    const evidence = prepared.view.attachments.find((row) => row.id === input.attachmentId)
    const attachment = await openSystemAttachments(this.c).findById(input.attachmentId)
    if (attachment instanceof Error)
      return new UnexpectedError("添付を固定できません", { cause: attachment })
    if (attachment === null || evidence === undefined)
      return new NotFoundError("添付が見つかりません", "attachment_not_found")
    if (
      !prepared.view.evidence_available ||
      attachment.status !== "linked" ||
      attachment.wrappedDek === null ||
      attachment.wrappedDekIv === null ||
      attachment.plaintextSha256 !== evidence.sha256 ||
      attachment.fileName !== evidence.file_name ||
      attachment.contentType !== evidence.content_type ||
      attachment.byteSize !== evidence.byte_size
    )
      return new UnprocessableError("確認した添付を利用できません", "attachment_evidence_changed")
    return {
      attachment,
      session: prepared.session,
      assertions: (now: Date): ReadonlyArray<D1PreparedStatement> | Error => {
        const current = prepared.assertions(now)
        if (current instanceof Error) return current
        return [...current, prepareSystemAttachmentContentReadGuard(this.c, attachment, now)]
      },
    }
  }
}
