import type { ThanksContext } from "@/contexts/thanks/configuration/thanks-context"
import { ThanksActorReadAdapter } from "@/contexts/thanks/infrastructure/adapters/thanks-actor-read.adapter"
import { ThanksError } from "@/contexts/thanks/domain/errors"
import {
  thanksRecordKindSchema,
  type ThanksRecordKind,
} from "@/contexts/thanks/domain/definitions/thanks-record-kind.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

type Context = ThanksContext
type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

function snapshotQuery(recordKind: ThanksRecordKind, recordId: string): SnapshotQuery | Error {
  const parsed = z.coerce.number().int().safe().safeParse(recordId)
  if (!parsed.success || String(parsed.data) !== recordId)
    return new Error("invalid thanks record id")
  const id = parsed.data
  if (recordKind === "thanks-message-record")
    return {
      sql: `SELECT json_object('format','thanks-message-record','version',1,'message',json_object(
      'id',id,'sender_employee_id',sender_employee_id,'recipient_employee_id',recipient_employee_id,
      'message',message,'points',points,'created_at',created_at)) AS snapshot_json
      FROM thanks_messages WHERE id=?1`,
      values: [id],
    }
  if (recordKind === "thanks-point-budget-record")
    return {
      sql: `SELECT json_object('format','thanks-point-budget-record','version',1,'budget',json_object(
      'id',id,'employee_id',employee_id,'period',period,'granted_points',granted_points,
      'consumed_points',consumed_points,'created_at',created_at)) AS snapshot_json
      FROM thanks_point_budgets WHERE id=?1`,
      values: [id],
    }
  if (recordKind === "thanks-reward-record")
    return {
      sql: `SELECT json_object('format','thanks-reward-record','version',1,'reward',json_object(
      'id',id,'name',name,'point_cost',point_cost,'is_active',is_active,'stock',stock,'created_at',created_at))
      AS snapshot_json FROM thanks_rewards WHERE id=?1`,
      values: [id],
    }
  return {
    sql: `SELECT json_object('format','thanks-redemption-record','version',1,'redemption',json_object(
      'id',id,'employee_id',employee_id,'reward_id',reward_id,'point_cost',point_cost,'status',status,
      'created_at',created_at,'decided_at',decided_at,'decider_id',decider_id)) AS snapshot_json
      FROM thanks_redemptions WHERE id=?1`,
    values: [id],
  }
}

/** 保全資格のある主体へサンクス4台帳の原記録を返し、保存直前にも同じ内容を検査する。 */
export class CaptureThanksRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(
    input: Readonly<{ recordKind: ThanksRecordKind; recordId: string; sourceNamespace: string }>,
  ) {
    const kind = thanksRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new ThanksError("forbidden", "invalid source record")
    const query = snapshotQuery(kind.data, input.recordId)
    if (query instanceof Error)
      return new ThanksError("forbidden", "invalid source record", { cause: query })
    const actor = await new ThanksActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("thanks source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("thanks source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "thanks",
        recordKind: kind.data,
        recordId: input.recordId,
        formatId: kind.data,
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: actor.now.toISOString(),
        contentDigest: digest.toString(),
      })
      if (source instanceof Error) return source
      return {
        source,
        content: new TextEncoder().encode(canonical.toString()),
        actorAccountId: actor.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "thanks",
          kind: "record-snapshot",
          id: input.recordId,
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN (SELECT snapshot_json FROM (${query.sql})) IS ?${query.values.length + 1}
            THEN 1 ELSE json_extract('', '$') END`).bind(...query.values, snapshot),
        ],
      }
    } catch (cause) {
      return new Error("thanks source capture failed", { cause })
    }
  }
}
