import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import type { CommendationContext } from "@/contexts/commendation/configuration/commendation-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { VerifyPreservedRecordSourceAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-source.adapter"
import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"

type Context = SystemD1Context &
  SystemDatabaseContext &
  SystemAttachmentStorageContext &
  CommendationContext &
  Readonly<{
    assertions: ReadonlyArray<D1PreparedStatement>
  }>
type Input = Readonly<{
  records: ReadonlyArray<Readonly<{ source: PreservedRecordSourceValue }>>
  mappings: ReadonlyArray<Readonly<{ sourceRecordId: number; preservedRecordId: string }>>
  purpose: string
}>

/** 元記録と保全本文を照合し、読取・保持の検査を保存時にも強制する。 */
export class PrepareCommendationCoverageRecordsAdapter {
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
    const verifier = new VerifyPreservedRecordSourceAdapter({
      env: this.c.env,
      var: this.c.var,
      now: this.c.var.now,
      assertions: this.c.assertions,
    })
    for (const record of input.records) {
      const preservedRecordId = mapping.get(record.source.props.recordId)
      if (preservedRecordId === undefined) return new Error("coverage source mapping missing")
      const verified = await verifier.execute({
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
      repository: new RecordCoveragePageRepository({ env: this.c.env, assertions }),
    }
  }
}
