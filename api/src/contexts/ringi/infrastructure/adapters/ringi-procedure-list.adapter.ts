import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { RingiProcedureReadAdapter } from "@/contexts/ringi/infrastructure/adapters/ringi-procedure-read.adapter"
import { ApplicationError, ForbiddenError, UnexpectedError } from "@/lib/errors"

type Context = CompanyContext
type Input = Readonly<{
  session: CompanyPersonnelSession
  tokenVersion: number
  at: Date
  mode: "mine" | "admin"
  status: string | null
  applicantId: EmployeeId | null
  sort: "created_at_desc" | "created_at_asc" | "amount_desc" | "amount_asc"
  limit: number
  offset: number
}>

/** 本人または全社閲覧権限の範囲で、差戻し・取消・実行待ちを含む稟議を列挙する。 */
export class RingiProcedureListAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async list(input: Input) {
    if (input.mode === "admin" && !input.session.hasPermission("ringi:read:all"))
      return new ForbiddenError("全社の稟議を参照する権限がありません", "forbidden")
    const where = `WHERE (?1 IS NULL OR request.applicant_id = ?1) AND (?2 IS NULL OR
      CASE WHEN workflow_case.status IN ('returned', 'cancelled') THEN workflow_case.status
        WHEN workflow_case.status = 'approved' AND request.status = 'pending' THEN 'awaiting_execution'
        ELSE request.status END = ?2)`
    const from = `FROM ringi_requests request LEFT JOIN ringi_procedure_bindings binding ON binding.ringi_id = request.id
      LEFT JOIN system_cases workflow_case ON workflow_case.id = binding.case_id`
    const sort = {
      created_at_desc: "request.created_at DESC, request.id DESC",
      created_at_asc: "request.created_at ASC, request.id ASC",
      amount_desc: "request.amount DESC, request.id DESC",
      amount_asc: "request.amount ASC, request.id ASC",
    }[input.sort]
    try {
      const applicantId = input.mode === "mine" ? input.session.employeeId : input.applicantId
      const rows = await this.c.env.DB.batch<{ id: number; total: number }>([
        this.c.env.DB.prepare(
          `SELECT request.id ${from} ${where} ORDER BY ${sort} LIMIT ?3 OFFSET ?4`,
        ).bind(applicantId, input.status, input.limit, input.offset),
        this.c.env.DB.prepare(`SELECT count(*) AS total ${from} ${where}`).bind(
          applicantId,
          input.status,
        ),
      ])
      const data = []
      for (const row of rows[0]?.results ?? []) {
        const view = await new RingiProcedureReadAdapter(this.c).find({
          ringiId: row.id,
          session: input.session,
          tokenVersion: input.tokenVersion,
          at: input.at,
        })
        if (view instanceof ApplicationError) return view
        data.push(view)
      }
      return { data, total: rows[1]?.results[0]?.total ?? 0 }
    } catch (cause) {
      return new UnexpectedError("稟議一覧を取得できません", { cause })
    }
  }
}
