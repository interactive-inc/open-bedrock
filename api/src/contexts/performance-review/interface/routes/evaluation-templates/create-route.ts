import { CreateEvaluationTemplate } from "@/contexts/performance-review/application/evaluation-template/create-evaluation-template"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppEvaluationTemplate } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { z } from "zod"

// @authorization permission - evaluation:administer で判定する
/**
 * POST /evaluation-templates — 評価テンプレートを新規作成する。
 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(200),
      period: z.string().min(1).max(100),
      items: z
        .array(
          z.object({
            title: z.string().min(1),
            default_weight: z.number().int().min(1).max(100),
            kpi_example: z.string().nullable().optional(),
          }),
        )
        .min(1),
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

    const template = await new CreateEvaluationTemplate(c).run({
      title: json.title,
      period: json.period,
      items: json.items.map((item) => ({
        title: item.title,
        defaultWeight: item.default_weight,
        kpiExample: item.kpi_example ?? null,
      })),
      createdBy: session.employeeId,
      now: new Date().toISOString(),
    })

    if (template instanceof ApplicationError) {
      throw toHttpException(template)
    }

    const responseBody = zAppEvaluationTemplate.parse({
      id: template.id,
      title: template.title,
      period: template.period,
      items: template.items.map((item) => ({
        title: item.title,
        default_weight: item.defaultWeight,
        kpi_example: item.kpiExample ?? null,
      })),
      status: template.status,
      created_by: template.createdBy,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    })

    return c.json(responseBody, 201)
  },
)
