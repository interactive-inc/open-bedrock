import { factory } from "@/interface/utils/factory"
import { zAppEvaluationSheetList } from "@/lib/app-schemas"
import { evaluationSheets } from "@/schema"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { and, asc, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

// @authorization owner - 本人のリソースに限定する
/**
 * GET /evaluation-sheets/me — 自分の評価シート一覧。
 * period / status でフィルタ可能。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const period = c.req.query("period") ?? null
  const status = c.req.query("status") ?? null

  const conditions: Array<SQL> = [eq(evaluationSheets.employeeId, session.employeeId)]

  if (period !== null) {
    conditions.push(eq(evaluationSheets.period, period))
  }

  if (status !== null) {
    conditions.push(eq(evaluationSheets.status, status))
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const where = and(...conditions)

  const rows = await c.var.database
    .select()
    .from(evaluationSheets)
    .where(where)
    .orderBy(asc(evaluationSheets.id))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(evaluationSheets)
    .where(where)

  const responseBody = zAppEvaluationSheetList.parse({
    data: rows.map((row) => ({
      id: row.id,
      employee_id: row.employeeId,
      template_id: row.templateId,
      period: row.period,
      status: row.status,
      primary_evaluator_id: row.primaryEvaluatorId,
      secondary_evaluator_id: row.secondaryEvaluatorId,
      submitted_at: row.submittedAt,
      approved_at: row.approvedAt,
      finalized_at: row.finalizedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
