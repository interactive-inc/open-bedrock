import { factory } from "@/interface/utils/factory"
import { zAppEvaluationSheet } from "@/lib/app-schemas"
import { evaluationSheets } from "@/schema"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { eq } from "drizzle-orm"
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"

// @authorization service - session を application service に渡して判定する
/**
 * GET /evaluation-sheets/:sheet_id — 評価シート 1 件取得。
 * 本人・一次評価者・二次評価者・evaluation:administer 保持者がアクセス可能。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const sheetId = validateIntParam(c.req.param("sheet_id"), "evaluation sheet")

  const rows = await c.var.database
    .select()
    .from(evaluationSheets)
    .where(eq(evaluationSheets.id, sheetId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("evaluation sheet not found")
  }

  // アクセス制御: 本人、一次/二次評価者、管理者のみ閲覧可
  const isOwner = row.employeeId === session.employeeId
  const isPrimaryEvaluator = row.primaryEvaluatorId === session.employeeId
  const isSecondaryEvaluator = row.secondaryEvaluatorId === session.employeeId
  const isAdmin = session.hasPermission("evaluation:administer")

  if (
    isOwner === false &&
    isPrimaryEvaluator === false &&
    isSecondaryEvaluator === false &&
    isAdmin === false
  ) {
    throw new ForbiddenError()
  }

  const responseBody = zAppEvaluationSheet.parse({
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
  })

  return c.json(responseBody, 200)
})
