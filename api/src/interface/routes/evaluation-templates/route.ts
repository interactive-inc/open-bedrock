import { factory } from "@/interface/utils/factory"
import { zAppEvaluationTemplateList } from "@/lib/app-schemas"
import { evaluationTemplates } from "@/schema"
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
