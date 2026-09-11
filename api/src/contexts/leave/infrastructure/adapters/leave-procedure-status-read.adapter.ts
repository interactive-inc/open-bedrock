import type { Context } from "@/env"
import { z } from "zod"

const rowSchema = z.object({
  id: z.number(),
  status: z.enum([
    "draft",
    "pending",
    "approved",
    "rejected",
    "returned",
    "cancelled",
    "awaiting_execution",
  ]),
})

/** 参照を許可された休暇の一覧へ、案件の取消・差戻し・未提出を反映する。 */
export class LeaveProcedureStatusReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(ids: ReadonlyArray<number>) {
    if (ids.length === 0) return new Map<number, z.infer<typeof rowSchema>["status"]>()
    const statements: D1PreparedStatement[] = []
    for (let offset = 0; offset < ids.length; offset += 90) {
      const chunk = ids.slice(offset, offset + 90)
      statements.push(
        this.c.env.DB.prepare(`SELECT request.id,
        CASE WHEN workflow_case.status IN ('returned','cancelled') THEN workflow_case.status
          WHEN request.status = 'pending' AND workflow_case.status IN ('approved','rejected') THEN 'awaiting_execution'
          WHEN request.status = 'pending' AND binding.leave_request_id IS NULL THEN 'draft'
          ELSE request.status END AS status
        FROM leave_requests request
        LEFT JOIN leave_procedure_bindings binding ON binding.leave_request_id = request.id
        LEFT JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
        WHERE request.id IN (${chunk.map(() => "?").join(",")})`).bind(...chunk),
      )
    }
    try {
      const pages = await this.c.env.DB.batch(statements)
      if (pages.length !== statements.length || pages.some((page) => !page.success))
        return new Error("leave status read failed")
      const rows = z.array(rowSchema).parse(pages.flatMap((page) => page.results))
      return new Map(rows.map((row) => [row.id, row.status]))
    } catch (cause) {
      return new Error("leave status read failed", { cause })
    }
  }
}
