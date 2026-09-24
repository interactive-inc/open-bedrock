import { z } from "zod"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { ForbiddenError } from "@/lib/errors"
import type { CareerContext } from "@/contexts/career/configuration/career-context"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { CareerActorReadAdapter } from "@/contexts/career/infrastructure/adapters/career-actor-read.adapter"
import { CaptureFrozenCareerRecordPageAdapter } from "@/contexts/career/infrastructure/adapters/capture-frozen-career-record-page.adapter"
import { PrepareCareerCoverageRecordsAdapter } from "@/contexts/career/infrastructure/adapters/prepare-career-coverage-records.adapter"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { prepareSystemRecordKindCoverage } from "@system/interface/operations/prepare-system-record-kind-coverage"
import { openSystemRecordCoveragePages } from "@system/interface/operations/open-system-record-coverage-pages"
import { careerRecordKindSchema } from "@/contexts/career/domain/definitions/career-record-kind.definition"

type Context = CareerContext & SystemAttachmentStorageContext & SystemDatabaseContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
  recordKind: careerRecordKindSchema,
  sequence: z.number().int().positive().safe(),
  terminalDigest: z.string().regex(/^[0-9a-f]{64}$/),
})

/** 計画に固定したcareer記録ページの原文・保全本文・保持条件を再検証し、保存条件を渡す。 */
export class PrepareCareerRetirementPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, stepUpToken: string) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new ForbiddenError("retirement authentication required", "forbidden")
    const authority = await prepareSystemRecordSourceFreezeAuthorization(this.c, {
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new ForbiddenError("retirement authorization denied", "forbidden")
    const chain = await prepareSystemRecordKindCoverage(
      {
        env: this.c.env,
        assertions: authority.assertions,
      },
      {
        freezeId: request.freezeId,
        sourceNamespace: request.sourceNamespace,
        purpose: request.purpose,
        ownerContext: "career",
        recordKind: request.recordKind,
      },
    )
    if (chain instanceof Error) return chain
    if (
      chain.summary.terminalDigest !== request.terminalDigest ||
      request.sequence > chain.summary.pageCount
    )
      return new Error("retirement coverage target changed")
    const stored = await openSystemRecordCoveragePages({
      env: this.c.env,
      assertions: chain.assertions,
    }).find({
      freezeId: request.freezeId,
      recordKind: request.recordKind,
      sequence: request.sequence,
    })
    if (stored instanceof Error) return stored
    if (stored === null) return new Error("coverage page disappeared")
    const cursor = stored.snapshot.afterCursor
    const captured = await new CaptureFrozenCareerRecordPageAdapter(this.c).prepare({
      freezeId: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      recordKind: request.recordKind,
      afterCursor: cursor,
      limit: 10,
    })
    if (captured instanceof Error) return captured
    if (captured.nextCursor !== stored.snapshot.nextCursor)
      return new Error("source inventory changed")
    const mappings = []
    for (const record of stored.snapshot.records) {
      const source = PreservedRecordSourceValue.create(record.source)
      if (source instanceof Error) return source
      if (source.props.recordKind !== request.recordKind)
        return new Error("retirement record kind changed")
      mappings.push({
        sourceRecordId: source.props.recordId,
        preservedRecordId: record.preservedRecordId,
      })
    }
    const verified = await new PrepareCareerCoverageRecordsAdapter({
      env: this.c.env,
      var: this.c.var,
      assertions: [...chain.assertions, ...captured.assertions],
    }).prepare({ records: captured.records, mappings, purpose: request.purpose })
    if (verified instanceof Error) return verified
    if (JSON.stringify(verified.records) !== JSON.stringify(stored.snapshot.records))
      return new Error("retirement source mapping changed")
    const current = await new CareerActorReadAdapter(this.c).prepare()
    if (current instanceof Error) return current
    const assertions = Object.freeze([...verified.assertions, ...current.assertions])
    try {
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement page changed")
      return Object.freeze({
        ...request,
        coveragePageId: stored.snapshot.id,
        coveragePageDigest: stored.digest,
        nextSequence: request.sequence === chain.summary.pageCount ? null : request.sequence + 1,
        checkedAt: this.c.var.now().toISOString(),
        records: Object.freeze(verified.records),
        assertions,
      })
    } catch (cause) {
      return new Error("retirement page unavailable", { cause })
    }
  }
}
