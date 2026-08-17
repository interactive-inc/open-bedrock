import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { zAppEvaluationSheetList } from "@/lib/app-schemas"
import { evaluationSheets } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { and, asc, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"

// @authorization permission - evaluation:administer で全社一覧を閲覧する
/**
 * GET /evaluation-sheets — 評価シート一覧。
 * evaluation:administer を持つ管理者のみ全社横断で閲覧可能。
 * period / status / employee_id でフィルタ可能。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("evaluation:administer") === false) {
    throw new ForbiddenError()
  }

  const period = c.req.query("period") ?? null
  const status = c.req.query("status") ?? null
  const employeeIdParam = c.req.query("employee_id")

  const conditions: Array<SQL> = []

  if (period !== null) {
    conditions.push(eq(evaluationSheets.period, period))
  }

  if (status !== null) {
    conditions.push(eq(evaluationSheets.status, status))
  }

  if (employeeIdParam !== undefined) {
    const employeeId = Number(employeeIdParam)

    if (Number.isInteger(employeeId)) {
      conditions.push(eq(evaluationSheets.employeeId, employeeId))
    }
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

  const where = conditions.length > 0 ? and(...conditions) : undefined

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
      revision: row.revision,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
