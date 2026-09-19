import { z } from "zod"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { ForbiddenError } from "@/lib/errors"
import type { DisciplinaryActionContext } from "@/contexts/disciplinary-action/configuration/disciplinary-action-context"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { DisciplinaryActionActorReadAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/disciplinary-action-actor-read.adapter"
import { CaptureFrozenDisciplinaryActionRecordPageAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/capture-frozen-disciplinary-action-record-page.adapter"
import { PrepareDisciplinaryActionCoverageRecordsAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/prepare-disciplinary-action-coverage-records.adapter"
import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"
import { PrepareRecordKindCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-kind-coverage.adapter"
import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"

type Context = DisciplinaryActionContext & SystemAttachmentStorageContext & SystemDatabaseContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
  recordKind: z.literal("disciplinary-action-record"),
  sequence: z.number().int().positive().safe(),
  terminalDigest: z.string().regex(/^[0-9a-f]{64}$/),
})

/** 計画に固定した懲戒記録ページの原文・保全本文・保持条件を再検証し、保存条件を渡す。 */
export class PrepareDisciplinaryActionRetirementPageAdapter {
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
    const authority = await new PrepareRecordSourceFreezeAuthorizationAdapter(this.c).prepare({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new ForbiddenError("retirement authorization denied", "forbidden")
    const chain = await new PrepareRecordKindCoverageAdapter({
      env: this.c.env,
      assertions: authority.assertions,
    }).prepare({
      freezeId: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      purpose: request.purpose,
      ownerContext: "disciplinary-action",
      recordKind: request.recordKind,
    })
    if (chain instanceof Error) return chain
    if (
      chain.summary.terminalDigest !== request.terminalDigest ||
      request.sequence > chain.summary.pageCount
    )
      return new Error("retirement coverage target changed")
    const stored = await new RecordCoveragePageRepository({
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
    if (cursor !== null && !/^(0|-?[1-9][0-9]*)$/.test(cursor))
      return new Error("invalid coverage cursor")
    const captured = await new CaptureFrozenDisciplinaryActionRecordPageAdapter(this.c).prepare({
      freezeId: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      afterId: cursor === null ? null : Number(cursor),
      limit: 10,
    })
    if (captured instanceof Error) return captured
    const nextCursor = captured.nextAfterId === null ? null : String(captured.nextAfterId)
    if (nextCursor !== stored.snapshot.nextCursor) return new Error("source inventory changed")
    const mappings = []
    for (const record of stored.snapshot.records) {
      const source = PreservedRecordSourceValue.create(record.source)
      if (source instanceof Error) return source
      const id = z.coerce.number().int().safe().safeParse(source.props.recordId)
      if (!id.success) return id.error
      mappings.push({ sourceRecordId: id.data, preservedRecordId: record.preservedRecordId })
    }
    const verified = await new PrepareDisciplinaryActionCoverageRecordsAdapter({
      env: this.c.env,
      var: this.c.var,
      assertions: [...chain.assertions, ...captured.assertions],
    }).prepare({ records: captured.records, mappings, purpose: request.purpose })
    if (verified instanceof Error) return verified
    if (JSON.stringify(verified.records) !== JSON.stringify(stored.snapshot.records))
      return new Error("retirement source mapping changed")
    const current = await new DisciplinaryActionActorReadAdapter(this.c).prepare()
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
