import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { SystemAttachmentStorageContext } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureExpenseSourceAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-source.adapter"

type Context = CompanyContext &
  SystemAttachmentStorageContext &
  Readonly<{ now: () => Date; sourceNamespace: string }>

/** 承認時の来歴・取得時点を維持し、現在の原記録と本文が一致することを検証する。 */
export class RevalidateExpenseRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    source: PreservedRecordSourceValue,
    reader: Readonly<{
      authentication: SystemReadAuthentication
      session: CompanyPersonnelSession
    }>,
  ) {
    if (
      source.props.ownerContext !== "expense" ||
      source.props.sourceNamespace !== this.c.sourceNamespace
    )
      return new Error("record source does not belong to this expense registry")
    const current = await new CaptureExpenseSourceAdapter(this.c).prepare(
      {
        recordKind: source.props.recordKind,
        recordId: source.props.recordId,
        sourceNamespace: this.c.sourceNamespace,
      },
      reader,
    )
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new Error("expense record differs from preservation proposal")
    return Object.freeze({ ...current, source })
  }
}
