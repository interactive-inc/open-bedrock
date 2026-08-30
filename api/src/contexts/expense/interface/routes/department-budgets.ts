import { CreateBudget } from "@/contexts/expense/application/budget/create-budget"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppBudget, zAppBudgetList } from "@/contexts/expense/interface/http/response-schemas"
import { isoDate } from "@/lib/validation/iso-date.schema"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { budgets } from "@/contexts/expense/infrastructure/schema/budget"
import { and, asc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zOrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { InternalError } from "@/lib/http/errors"

// @authorization permission - 権限キーで判定する
/** GET /department-budgets — 部署予算の一覧。部署・会計期間で絞り込む。budget:manage を持つロールのみ。 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      organization_unit_id: zOrganizationUnitId.optional(),
      fiscal_period: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("budget:manage") === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const conditions: Array<SQL> = []

    if (query.organization_unit_id !== undefined) {
      conditions.push(eq(budgets.organizationUnitId, query.organization_unit_id))
    }

    if (query.fiscal_period !== undefined && query.fiscal_period !== "") {
      conditions.push(eq(budgets.fiscalPeriod, query.fiscal_period))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const rows = await c.var.database
      .select({
        id: budgets.id,
        organizationUnitId: budgets.organizationUnitId,
        fiscalPeriod: budgets.fiscalPeriod,
        periodStart: budgets.periodStart,
        periodEnd: budgets.periodEnd,
        amount: budgets.amount,
        name: budgets.name,
        note: budgets.note,
        createdAt: budgets.createdAt,
      })
      .from(budgets)
      .where(where)
      .orderBy(asc(budgets.organizationUnitId), asc(budgets.fiscalPeriod))

    const snapshot = await new ReadCanonicalOrganizationStateAdapter(
      c,
    ).readCanonicalOrganizationState()
    if (snapshot instanceof Error) throw new InternalError("failed to load organization units")
    const unitNames = new Map(
      snapshot.organization.units.map((unit) => [unit.organizationUnitId, unit.officialName]),
    )

    const responseBody = zAppBudgetList.parse({
      data: rows.map((row) => ({
        id: row.id,
        organization_unit_id: row.organizationUnitId,
        organization_unit_name: unitNames.get(row.organizationUnitId) ?? null,
        fiscal_period: row.fiscalPeriod,
        period_start: row.periodStart,
        period_end: row.periodEnd,
        amount: row.amount,
        name: row.name,
        note: row.note,
        created_at: row.createdAt,
      })),
      total: rows.length,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization permission - 権限キーで判定する
/** POST /department-budgets — 部署予算を登録する。budget:manage を持つロールのみ。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      organization_unit_id: zOrganizationUnitId,
      fiscal_period: z.string().min(1).max(200),
      period_start: isoDate,
      period_end: isoDate,
      amount: z.number().positive().int().safe(),
      name: z.string().min(1).max(200),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("budget:manage") === false) {
      throw new ForbiddenError()
    }

    const body = c.req.valid("json")

    const created = await new CreateBudget(c).run({
      organizationUnitId: body.organization_unit_id,
      fiscalPeriod: body.fiscal_period,
      periodStart: body.period_start,
      periodEnd: body.period_end,
      amount: body.amount,
      name: body.name,
      note: body.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppBudget.parse({
      id: created.id,
      organization_unit_id: created.organizationUnitId,
      fiscal_period: created.fiscalPeriod,
      period_start: created.periodStart,
      period_end: created.periodEnd,
      amount: created.amount,
      name: created.name,
      note: created.note,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
