import { UpdateEvaluationTemplate } from "@/contexts/company/application/evaluation-template/update-evaluation-template"
import { SetEvaluationTemplateStatus } from "@/contexts/company/application/evaluation-template/set-evaluation-template-status"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppEvaluationTemplate } from "@/lib/app-schemas"
import { evaluationTemplateStatusSchema } from "@/contexts/company/domain/evaluation-template/evaluation-template.entity"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { evaluationTemplates } from "@/schema"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { z } from "zod"

function toResponseItem(row: { title: string; defaultWeight: number; kpiExample?: string | null }) {
  return {
    title: row.title,
    default_weight: row.defaultWeight,
    kpi_example: row.kpiExample ?? null,
  }
}

// @authorization authenticated - テンプレートは共有データなので誰でも閲覧可
/**
 * GET /evaluation-templates/:template_id — 評価テンプレート 1 件取得。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const templateId = validateIntParam(c.req.param("template_id"), "evaluation template")

  const rows = await c.var.database
    .select()
    .from(evaluationTemplates)
    .where(eq(evaluationTemplates.id, templateId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("evaluation template not found")
  }

  const items = JSON.parse(row.items) as Array<{
    title: string
    defaultWeight: number
    kpiExample?: string | null
  }>

  const responseBody = zAppEvaluationTemplate.parse({
    id: row.id,
    title: row.title,
    period: row.period,
    items: items.map(toResponseItem),
    status: row.status,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  })

  return c.json(responseBody, 200)
})

// @authorization permission - evaluation:administer で判定する
/**
 * PUT /evaluation-templates/:template_id — 評価テンプレートを更新する。
 */
export const PUT = factory.createHandlers(
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

    const templateId = validateIntParam(c.req.param("template_id"), "evaluation template")
    const json = c.req.valid("json")

    const template = await new UpdateEvaluationTemplate(c).run({
      templateId,
      title: json.title,
      period: json.period,
      items: json.items.map((item) => ({
        title: item.title,
        defaultWeight: item.default_weight,
        kpiExample: item.kpi_example ?? null,
      })),
      now: new Date().toISOString(),
    })

    if (template instanceof ApplicationError) {
      throw toHttpException(template)
    }

    const responseBody = zAppEvaluationTemplate.parse({
      id: template.id,
      title: template.title,
      period: template.period,
      items: template.items.map(toResponseItem),
      status: template.status,
      created_by: template.createdBy,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization permission - evaluation:administer で判定する
/**
 * PATCH /evaluation-templates/:template_id — 評価テンプレートのステータスを変更する。
 */
export const PATCH = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      status: evaluationTemplateStatusSchema,
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

    const templateId = validateIntParam(c.req.param("template_id"), "evaluation template")
    const json = c.req.valid("json")

    const template = await new SetEvaluationTemplateStatus(c).run({
      templateId,
      status: json.status,
      now: new Date().toISOString(),
    })

    if (template instanceof ApplicationError) {
      throw toHttpException(template)
    }

    const responseBody = zAppEvaluationTemplate.parse({
      id: template.id,
      title: template.title,
      period: template.period,
      items: template.items.map(toResponseItem),
      status: template.status,
      created_by: template.createdBy,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    })

    return c.json(responseBody, 200)
  },
)
