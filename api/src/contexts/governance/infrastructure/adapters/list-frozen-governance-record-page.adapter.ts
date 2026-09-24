import { z } from "zod"
import type { GovernanceContext } from "@/contexts/governance/configuration/governance-context"
import {
  decodeGovernanceRecordId,
  encodeGovernanceRecordId,
  governanceRecordKindSchema,
} from "@/contexts/governance/domain/definitions/governance-record-kind.definition"
import { governanceSourceTables } from "@/contexts/governance/infrastructure/adapters/lib/governance-snapshot-query"
import { GovernanceActorReadAdapter } from "@/contexts/governance/infrastructure/adapters/governance-actor-read.adapter"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"

type Context = GovernanceContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: governanceRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 停止した規程8台帳を単一・複合主キー順に分割し、停止世代も同じ読取で確認する。 */
export class ListFrozenGovernanceRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new GovernanceActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await openSystemRecordSourceFreezes({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "governance",
    })
    if (generation instanceof Error) return generation
    const source = governanceSourceTables[request.recordKind]
    const after = request.afterCursor
    const parts = after === null ? null : decodeGovernanceRecordId(after, source.keys.length)
    if (after !== null && parts === null) return new Error("invalid governance cursor")
    try {
      const columns = source.keys.join(",")
      const placeholders = source.keys.map((_, index) => `?${index + 1}`).join(",")
      const condition =
        source.keys.length === 1 ? `${columns}>?1` : `(${columns})>(${placeholders})`
      const sql =
        after === null
          ? `SELECT ${columns} FROM ${source.table} ORDER BY ${columns} LIMIT ?1`
          : `SELECT ${columns} FROM ${source.table} WHERE ${condition} ORDER BY ${columns} LIMIT ?${source.keys.length + 1}`
      const values = after === null ? [request.limit + 1] : [...(parts ?? []), request.limit + 1]
      const page = this.c.env.DB.prepare(sql).bind(...values)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<Record<string, string | number>>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen governance inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        encodeGovernanceRecordId(source.keys.map((key) => String(row[key]))),
      )
      if (new Set(ids).size !== ids.length) return new Error("invalid governance inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen governance inventory unavailable", { cause })
    }
  }
}
