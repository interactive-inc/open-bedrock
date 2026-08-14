import { CreateEvaluationSheet } from "@/application/evaluation-sheet/create-evaluation-sheet"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppEvaluationSheet } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// @authorization permission - evaluation:administer で判定する
/**
 * POST /evaluation-sheets — 評価シートを新規作成する。
 * primary_evaluator_id 省略時は org_memberships から directManager を自動解決する。
 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_id: z.number().int().positive(),
      template_id: z.number().int().positive().nullable().optional(),
      period: z.string().min(1).max(100),
      primary_evaluator_id: z.number().int().positive().optional(),
      secondary_evaluator_id: z.number().int().positive().nullable().optional(),
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

    const json = c.req.valid("json")

    const sheet = await new CreateEvaluationSheet(c).run({
      employeeId: json.employee_id,
      templateId: json.template_id ?? null,
      period: json.period,
      primaryEvaluatorId: json.primary_evaluator_id,
      secondaryEvaluatorId: json.secondary_evaluator_id ?? null,
      creatorEmployeeId: session.employeeId,
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

    return c.json(responseBody, 201)
  },
)
