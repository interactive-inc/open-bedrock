import type { SystemD1Context } from "@system/configuration/system-context"
import { prepareSystemAttachmentEvidence } from "@system/interface/operations/prepare-system-attachment-evidence"

type Context = SystemD1Context

/** 経費へ紐付ける添付の所有者・内容・状態を、Systemの公開operationで固定する。 */
export class ExpenseAttachmentEvidenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(input: Parameters<typeof prepareSystemAttachmentEvidence>[1]) {
    return prepareSystemAttachmentEvidence(this.c, input)
  }
}
