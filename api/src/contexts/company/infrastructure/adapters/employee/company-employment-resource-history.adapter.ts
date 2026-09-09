import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { z } from "zod"

const date = z.string().refine(isCalendarDate)
type Context = D1Database

/** 公開雇用の全revisionを同じ属性・日付契約で復元する。 */
export class CompanyEmploymentResourceHistoryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async read(
    resource: Readonly<{ organizationId: string; id: string }>,
  ): Promise<ReadonlyArray<CompanyResourceProps> | Error> {
    const rows = await this.c
      .prepare(`SELECT revision, state, effective_from, effective_to, attributes_json
      FROM company_resource_revisions WHERE organization_id = ?1 AND resource_type = 'employment' AND resource_id = ?2
      ORDER BY revision`)
      .bind(resource.organizationId, resource.id)
      .all()
    if (!rows.success) return new Error("failed to read employment resource history")
    const parsed = z
      .array(
        z.object({
          revision: z.number().int().positive(),
          state: z.enum(["active", "void"]),
          effective_from: date,
          effective_to: date.nullable(),
          attributes_json: z.string(),
        }),
      )
      .safeParse(rows.results)
    if (!parsed.success) return parsed.error
    const history: CompanyResourceProps[] = []
    for (const row of parsed.data) {
      const attributes = z.record(z.string(), z.json()).safeParse(JSON.parse(row.attributes_json))
      if (!attributes.success) return attributes.error
      const resourceProps: CompanyResourceProps = {
        organizationId: resource.organizationId,
        type: "employment",
        id: resource.id,
        revision: row.revision,
        state: row.state,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
        attributes: attributes.data,
      }
      history.push(resourceProps)
    }
    return history
  }
}
