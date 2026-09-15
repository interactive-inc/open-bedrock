import type { AssetContext } from "@/contexts/asset/configuration/asset-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureAssetRecordAdapter } from "@/contexts/asset/infrastructure/adapters/capture-asset-record.adapter"
import { AssetError } from "@/contexts/asset/domain/errors"
import { assetRecordKindSchema } from "@/contexts/asset/domain/asset-record-kind"

type Context = AssetContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateAssetRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "asset"
    )
      return new AssetError("forbidden", "record source does not belong to this asset registry")

    const recordKind = assetRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new AssetError("forbidden", "invalid asset record kind")
    const current = await new CaptureAssetRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new AssetError(
        "asset_conflict",
        "asset record differs from preservation proposal",
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
