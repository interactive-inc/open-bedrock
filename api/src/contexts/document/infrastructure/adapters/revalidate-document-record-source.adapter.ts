import type { DocumentContext } from "@/contexts/document/configuration/document-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureDocumentRecordAdapter } from "@/contexts/document/infrastructure/adapters/capture-document-record.adapter"
import { DocumentError } from "@/contexts/document/domain/errors"
import { z } from "zod"

type Context = DocumentContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateDocumentRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "document" ||
      source.props.recordKind !== "document-record"
    )
      return new DocumentError(
        "forbidden",
        "record source does not belong to this document registry",
      )

    const documentId = z.uuid().safeParse(source.props.recordId)
    if (!documentId.success || String(documentId.data) !== source.props.recordId)
      return new DocumentError("forbidden", "invalid document record identifier")
    const current = await new CaptureDocumentRecordAdapter(this.c).prepare({
      documentId: documentId.data,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new DocumentError(
        "document_conflict",
        "document record differs from preservation proposal",
      )

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
