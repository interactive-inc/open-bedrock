import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { CreateEvaluationTemplate } from "@/contexts/performance-review/application/evaluation-template/create-evaluation-template"
import { evaluationTemplates } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import {
  zAppEvaluationTemplate,
  zAppEvaluationTemplateList,
} from "@/contexts/performance-review/interface/http/response-schemas"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, eq, type SQL } from "drizzle-orm"
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

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/**
 * GET /evaluation-templates — 評価テンプレート一覧。
 * period / status でフィルタ可能。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const period = c.req.query("period") ?? null
  const status = c.req.query("status") ?? null

  const conditions: Array<SQL> = []

  if (period !== null) {
    conditions.push(eq(evaluationTemplates.period, period))
  }

  if (status !== null) {
    conditions.push(eq(evaluationTemplates.status, status))
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
    .from(evaluationTemplates)
    .where(where)
    .orderBy(asc(evaluationTemplates.id))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(evaluationTemplates)
    .where(where)

  const responseBody = zAppEvaluationTemplateList.parse({
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      period: row.period,
      items: JSON.parse(row.items).map(
        (item: { title: string; defaultWeight: number; kpiExample?: string | null }) => ({
          title: item.title,
          default_weight: item.defaultWeight,
          kpi_example: item.kpiExample ?? null,
        }),
      ),
      status: row.status,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
