import { TransitionEvaluationSheet } from "@/application/evaluation-sheet/transition-evaluation-sheet"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppEvaluationSheet } from "@/lib/app-schemas"
import { evaluationSheetStatusSchema } from "@/domain/evaluation-sheet/evaluation-sheet.entity"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { evaluationSheets } from "@/schema"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/**
 * POST /evaluation-sheets/:sheet_id/transition — 評価シートのステータスを遷移させる。
 *
 * 遷移権限:
 * - draft → pending_approval: 本人
 * - pending_approval → approved/rejected: 一次評価者
 * - rejected → draft: 本人
 * - approved → self_eval: 本人
 * - self_eval → primary_eval: 本人
 * - primary_eval → secondary_eval: 一次評価者
 * - primary_eval → finalized: 一次評価者（二次評価者未設定時のみ）
 * - secondary_eval → finalized: 二次評価者 or evaluation:administer
 * - finalized → reopened: evaluation:administer
 * - finalized → archived: evaluation:administer
 * - reopened → self_eval: evaluation:administer
 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      status: evaluationSheetStatusSchema,
      note: z.string().max(1_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const sheetId = validateIntParam(c.req.param("sheet_id"), "evaluation sheet")
    const json = c.req.valid("json")

    // シートを先読みして権限判定
    const rows = await c.var.database
      .select()
      .from(evaluationSheets)
      .where(eq(evaluationSheets.id, sheetId))
      .limit(1)

    const row = rows.at(0)

    if (row === undefined) {
      throw new NotFoundError("evaluation sheet not found")
    }

    const isOwner = row.employeeId === session.employeeId
    const isPrimaryEvaluator = row.primaryEvaluatorId === session.employeeId
    const isSecondaryEvaluator = row.secondaryEvaluatorId === session.employeeId
    const isAdmin = session.hasPermission("evaluation:administer")

    // 遷移権限の判定
    const targetStatus = json.status
    let allowed = false

    if (targetStatus === "pending_approval" && isOwner) allowed = true
    if (targetStatus === "approved" && (isPrimaryEvaluator || isAdmin)) allowed = true
    if (targetStatus === "rejected" && (isPrimaryEvaluator || isAdmin)) allowed = true
    if (targetStatus === "draft" && isOwner) allowed = true
    if (targetStatus === "self_eval" && (isOwner || isAdmin)) allowed = true
    if (targetStatus === "primary_eval" && isOwner) allowed = true
    if (targetStatus === "secondary_eval" && isPrimaryEvaluator) allowed = true
    // finalized: 二次評価者から or 管理者。二次評価者未設定時は一次評価者も可
    if (targetStatus === "finalized" && (isSecondaryEvaluator || isAdmin)) allowed = true
    if (targetStatus === "finalized" && isPrimaryEvaluator && row.secondaryEvaluatorId === null)
      allowed = true
    if (targetStatus === "reopened" && isAdmin) allowed = true
    if (targetStatus === "archived" && isAdmin) allowed = true

    if (allowed === false) {
      throw new ForbiddenError()
    }

    const sheet = await new TransitionEvaluationSheet(c).run({
      sheetId,
      targetStatus,
      actorEmployeeId: session.employeeId,
      note: json.note ?? null,
      now: new Date().toISOString(),
    })

    if (sheet instanceof ApplicationError) {
      throw toHttpException(sheet)
    }

    const responseBody = zAppEvaluationSheet.parse({
      id: sheet.id,
      employee_id: sheet.employeeId,
      template_id: sheet.templateId,
      period: sheet.period,
      status: sheet.status,
      primary_evaluator_id: sheet.primaryEvaluatorId,
      secondary_evaluator_id: sheet.secondaryEvaluatorId,
      submitted_at: sheet.submittedAt,
      approved_at: sheet.approvedAt,
      finalized_at: sheet.finalizedAt,
      created_at: sheet.createdAt,
      updated_at: sheet.updatedAt,
    })

    return c.json(responseBody, 200)
  },
)
