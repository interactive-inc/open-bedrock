import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { SystemAttachmentStorageContext } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareExpenseAttachmentReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-attachment-read.adapter"
import { CaptureLinkedAttachmentRecordAdapter } from "@system/infrastructure/adapters/records/capture-linked-attachment-record.adapter"

type Context = CompanyContext & SystemAttachmentStorageContext & Readonly<{ now: () => Date }>
type Input = Readonly<{
  expenseId: number
  attachmentId: string
  sourceNamespace: string
  authentication: SystemReadAuthentication
  session: CompanyPersonnelSession
}>

/** 経費の現在の閲覧資格と添付対応を、Systemの原添付取得へ接続する。 */
export class ExpenseAttachmentRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async authorize(input: Input) {
    const now = this.c.now()
    const prepared = await new PrepareExpenseAttachmentReadAdapter(this.c).prepare({
      expenseId: input.expenseId,
      attachmentId: input.attachmentId,
      authentication: input.authentication,
      session: input.session,
      at: now,
    })
    if (prepared instanceof Error) return prepared
    const assertions = prepared.assertions(this.c.now())
    if (assertions instanceof Error) return assertions
    return { accountId: input.authentication.accountId, now, assertions }
  }

  async capture(input: Input) {
    const authorized = await this.authorize(input)
    if (authorized instanceof Error) return authorized
    const captured = await new CaptureLinkedAttachmentRecordAdapter({
      env: this.c.env,
      var: this.c.var,
      now: this.c.now,
      assertions: authorized.assertions,
    }).prepare({
      attachmentId: input.attachmentId,
      sourceNamespace: input.sourceNamespace,
      ownerContext: "expense",
      recordKind: "expense-attachment",
    })
    if (captured instanceof Error) return captured
    return Object.freeze({
      source: captured.source,
      content: captured.content.toBytes(),
      actorAccountId: authorized.accountId,
      sourceAuthorizationRef: Object.freeze({
        context: "expense",
        kind: "expense-attachment",
        id: `${input.expenseId}:${input.attachmentId}`,
        version: captured.source.props.contentDigest,
      }),
      assertions: captured.assertions,
    })
  }
}
