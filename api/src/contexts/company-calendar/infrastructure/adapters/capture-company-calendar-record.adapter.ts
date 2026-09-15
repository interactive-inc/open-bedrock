import type { CompanyCalendarDayContext } from "@/contexts/company-calendar/configuration/company-calendar-context"
import { CompanyCalendarDayActorReadAdapter } from "@/contexts/company-calendar/infrastructure/adapters/company-calendar-actor-read.adapter"
import { CompanyCalendarDayError } from "@/contexts/company-calendar/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'company-calendar-record', 'version', 1,
  'company-calendar', json_object(
    'id', id,
    'calendar_date', calendar_date,
    'kind', kind,
    'name', name,
    'created_at', created_at
  )
) AS snapshot_json FROM company_calendar_days WHERE id = ?1`

type Context = CompanyCalendarDayContext

/** 管理資格のある主体へ会社カレンダー原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureCompanyCalendarDayRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ companyCalendarDayId: number; sourceNamespace: string }>) {
    if (!Number.isSafeInteger(input.companyCalendarDayId) || input.companyCalendarDayId < 1)
      return new CompanyCalendarDayError("forbidden", "invalid source record")
    const actor = await new CompanyCalendarDayActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.companyCalendarDayId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("company-calendar source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("company-calendar source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "company-calendar",
        recordKind: "company-calendar-record",
        recordId: String(input.companyCalendarDayId),
        formatId: "company-calendar-record",
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
          context: "company-calendar",
          kind: "record-snapshot",
          id: String(input.companyCalendarDayId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.companyCalendarDayId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("company-calendar source capture failed", { cause })
    }
  }
}
