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
import { CreateEvaluationSheet } from "@/contexts/performance-review/application/evaluation-sheet/create-evaluation-sheet"
import { evaluationSheets } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { zAppEvaluationSheet, zAppEvaluationSheetList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, eq, type SQL } from "drizzle-orm"
import { z } from "zod"

// @authorization permission - evaluation:administer で判定する
/**
 * POST /evaluation-sheets — 評価シートを新規作成する。
 * primary_evaluator_id 省略時はcanonical Company snapshotからdirect managerを自動解決する。
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
