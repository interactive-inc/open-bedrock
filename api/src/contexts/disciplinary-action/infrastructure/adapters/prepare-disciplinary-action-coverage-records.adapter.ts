import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import type { DisciplinaryActionContext } from "@/contexts/disciplinary-action/configuration/disciplinary-action-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { verifySystemPreservedRecordSource } from "@system/interface/operations/verify-system-preserved-record-source"
import { openSystemRecordCoveragePages } from "@system/interface/operations/open-system-record-coverage-pages"

type Context = SystemD1Context &
  SystemDatabaseContext &
  SystemAttachmentStorageContext &
  DisciplinaryActionContext &
  Readonly<{
    assertions: ReadonlyArray<D1PreparedStatement>
  }>
type Input = Readonly<{
  records: ReadonlyArray<Readonly<{ source: PreservedRecordSourceValue }>>
  mappings: ReadonlyArray<Readonly<{ sourceRecordId: number; preservedRecordId: string }>>
  purpose: string
}>

/** 元記録と保全本文を照合し、読取・保持の検査を保存時にも強制する。 */
export class PrepareDisciplinaryActionCoverageRecordsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Input) {
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined) return new Error("coverage authentication required")
    const mapping = new Map(
      input.mappings.map((record) => [String(record.sourceRecordId), record.preservedRecordId]),
    )
    if (mapping.size !== input.mappings.length || mapping.size !== input.records.length)
      return new Error("coverage mapping is incomplete or duplicated")
    const records = []
    const assertions = [...this.c.assertions]
    const verifierContext: Parameters<typeof verifySystemPreservedRecordSource>[0] = {
      env: this.c.env,
      var: this.c.var,
      now: this.c.var.now,
      assertions: this.c.assertions,
    }
    for (const record of input.records) {
      const preservedRecordId = mapping.get(record.source.props.recordId)
      if (preservedRecordId === undefined) return new Error("coverage source mapping missing")
      const verified = await verifySystemPreservedRecordSource(verifierContext, {
        authentication,
        recordId: preservedRecordId,
        purpose: input.purpose,
        source: record.source,
      })
      if (verified instanceof Error) return verified
      records.push({ preservedRecordId, source: verified.source })
      assertions.push(...verified.assertions)
    }
    return {
      records,
      assertions: Object.freeze(assertions),
      repository: openSystemRecordCoveragePages({ env: this.c.env, assertions }),
    }
  }
}
