import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { ApproveEvaluationSheet } from "@/contexts/performance-review/application/evaluation-sheet/approve-evaluation-sheet"
import { ArchiveEvaluationSheet } from "@/contexts/performance-review/application/evaluation-sheet/archive-evaluation-sheet"
import { CompleteEvaluationSheetPrimaryEvaluation } from "@/contexts/performance-review/application/evaluation-sheet/complete-evaluation-sheet-primary-evaluation"
import { CompleteEvaluationSheetSelfEvaluation } from "@/contexts/performance-review/application/evaluation-sheet/complete-evaluation-sheet-self-evaluation"
import { FinalizeEvaluationSheet } from "@/contexts/performance-review/application/evaluation-sheet/finalize-evaluation-sheet"
import { RejectEvaluationSheet } from "@/contexts/performance-review/application/evaluation-sheet/reject-evaluation-sheet"
import { ReopenEvaluationSheet } from "@/contexts/performance-review/application/evaluation-sheet/reopen-evaluation-sheet"
import { ReturnEvaluationSheetToDraft } from "@/contexts/performance-review/application/evaluation-sheet/return-evaluation-sheet-to-draft"
import { StartEvaluationSheetSelfEvaluation } from "@/contexts/performance-review/application/evaluation-sheet/start-evaluation-sheet-self-evaluation"
import { SubmitEvaluationSheet } from "@/contexts/performance-review/application/evaluation-sheet/submit-evaluation-sheet"
import { evaluationSheetStatusSchema } from "@/contexts/performance-review/domain/entities/evaluation-sheet.entity"
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zAppEvaluationSheet } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { evaluationSheets } from "@/contexts/performance-review/infrastructure/schema/performance-review"

// @authorization service - session を application service に渡して判定する
/**
 * POST /evaluation-sheets/:sheetId/transition — 評価シートのステータスを遷移させる。
 *
 * 遷移権限:
 * - draft → pending_approval: 本人
 * - pending_approval → approved/rejected: 一次評価者
 * - rejected → draft: 本人
 * - approved → self_eval: 本人
 * - self_eval → primary_eval: 本人
 * - primary_eval → secondary_eval: 一次評価者
 * - primary_eval → finalized: 一次評価者（二次評価者未設定時のみ）or evaluation:administer
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
      expected_revision: z.number().int().positive(),
      note: z.string().max(1_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const sheetId = validateIntParam(c.req.param("sheetId"), "evaluation sheet")
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

    // 遷移権限の判定 — currentStatus × targetStatus × role マトリクス
    const currentStatus = row.status
    const targetStatus = json.status
    const allowed = (() => {
      if (currentStatus === "draft" && targetStatus === "pending_approval" && isOwner) return true
      if (currentStatus === "pending_approval" && targetStatus === "approved" && isPrimaryEvaluator)
        return true
      if (currentStatus === "pending_approval" && targetStatus === "rejected" && isPrimaryEvaluator)
        return true
      if (currentStatus === "rejected" && targetStatus === "draft" && isOwner) return true
      if (currentStatus === "approved" && targetStatus === "self_eval" && isOwner) return true
      if (currentStatus === "self_eval" && targetStatus === "primary_eval" && isOwner) return true
      if (
        currentStatus === "primary_eval" &&
        targetStatus === "secondary_eval" &&
        isPrimaryEvaluator
      )
        return true
      // primary_eval → finalized: 一次評価者（二次評価者未設定時のみ）or admin
      if (
        currentStatus === "primary_eval" &&
        targetStatus === "finalized" &&
        row.secondaryEvaluatorId === null &&
        (isPrimaryEvaluator || isAdmin)
      )
        return true
      // secondary_eval → finalized: 二次評価者 or admin
      if (
        currentStatus === "secondary_eval" &&
        targetStatus === "finalized" &&
        (isSecondaryEvaluator || isAdmin)
      )
        return true
      if (currentStatus === "finalized" && targetStatus === "reopened" && isAdmin) return true
      if (currentStatus === "finalized" && targetStatus === "archived" && isAdmin) return true
      if (currentStatus === "reopened" && targetStatus === "self_eval" && isAdmin) return true
      return false
    })()

    if (allowed === false) {
      throw new ForbiddenError()
    }

    const command = {
      sheetId,
      actorEmployeeId: session.employeeId,
      expectedRevision: json.expected_revision,
      note: json.note ?? null,
      now: c.env.NOW ?? new Date().toISOString(),
    }
    let sheet
    if (targetStatus === "pending_approval") {
      sheet = await new SubmitEvaluationSheet(c).execute(command)
    } else if (targetStatus === "approved") {
      sheet = await new ApproveEvaluationSheet(c).execute(command)
    } else if (targetStatus === "rejected") {
      sheet = await new RejectEvaluationSheet(c).execute(command)
    } else if (targetStatus === "draft") {
      sheet = await new ReturnEvaluationSheetToDraft(c).execute(command)
    } else if (targetStatus === "self_eval") {
      sheet = await new StartEvaluationSheetSelfEvaluation(c).execute(command)
    } else if (targetStatus === "primary_eval") {
      sheet = await new CompleteEvaluationSheetSelfEvaluation(c).execute(command)
    } else if (targetStatus === "secondary_eval") {
      sheet = await new CompleteEvaluationSheetPrimaryEvaluation(c).execute(command)
    } else if (targetStatus === "finalized") {
      sheet = await new FinalizeEvaluationSheet(c).execute(command)
    } else if (targetStatus === "reopened") {
      sheet = await new ReopenEvaluationSheet(c).execute(command)
    } else if (targetStatus === "archived") {
      sheet = await new ArchiveEvaluationSheet(c).execute(command)
    } else {
      throw new Error("unreachable evaluation sheet status")
    }

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
      revision: sheet.revision,
      created_at: sheet.createdAt,
      updated_at: sheet.updatedAt,
    })

    return c.json(responseBody, 200)
  },
)
