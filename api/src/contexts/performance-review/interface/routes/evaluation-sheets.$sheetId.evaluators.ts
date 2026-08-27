import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { ChangeEvaluators } from "@/contexts/performance-review/application/evaluation-sheet/change-evaluators"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppEvaluationSheet } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { z } from "zod"

// @authorization permission - evaluation:administer で判定する
/**
 * PUT /evaluation-sheets/:sheetId/evaluators — 評価者を変更する（HR/admin 専用）。
 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      primary_evaluator_id: zEmployeeId,
      secondary_evaluator_id: zEmployeeId.nullable().optional(),
      expected_revision: z.number().int().positive(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("evaluation:administer") === false) {
      throw new ForbiddenError()
    }

    const sheetId = validateIntParam(c.req.param("sheetId"), "evaluation sheet")
    const json = c.req.valid("json")

    const sheet = await new ChangeEvaluators(c).run({
      sheetId,
      primaryEvaluatorId: json.primary_evaluator_id,
      secondaryEvaluatorId: json.secondary_evaluator_id ?? null,
      expectedRevision: json.expected_revision,
      actorEmployeeId: session.employeeId,
      now: c.env.NOW ?? new Date().toISOString(),
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
      revision: sheet.revision,
      created_at: sheet.createdAt,
      updated_at: sheet.updatedAt,
    })

    return c.json(responseBody, 200)
  },
)
