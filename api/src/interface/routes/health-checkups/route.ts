import { CreateHealthCheckup } from "@/application/health-checkup/create-health-checkup"
import { HealthCheckupRepository } from "@/infrastructure/health-checkup/health-checkup-repository"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { zAppHealthCheckup, zAppHealthCheckupList } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/**
 * GET /health-checkups?fiscal_year=&employee_id= — 健診・ストレスチェックの実施記録一覧。
 * 本人分は誰でも、他人分は health_checkup:read:all を持つロール(hr / admin)のみ閲覧できる。
 * 健診は要配慮情報のため監査ロールには見せない。結果は返さない（実施情報のみ）。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      fiscal_year: z.string().optional(),
      employee_id: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const canViewAll = session.hasPermission("health_checkup:read:all")

    // employee_id 指定なし: read:all は全社を、それ以外は本人分を見る。
    // employee_id 指定あり: 本人分 or read:all のみ許可する。
    let employeeId: number | undefined = undefined

    if (query.employee_id !== undefined && query.employee_id !== "") {
      const requestedId = Number(query.employee_id)

      if (Number.isInteger(requestedId) === false) {
        throw new BadRequestError("invalid parameter")
      }

      if (requestedId !== session.employeeId && canViewAll === false) {
        throw new ForbiddenError()
      }

      employeeId = requestedId
    } else if (canViewAll === false) {
      employeeId = session.employeeId
    }

    const fiscalYear =
      query.fiscal_year !== undefined && query.fiscal_year !== ""
        ? Number(query.fiscal_year)
        : undefined

    if (fiscalYear !== undefined && Number.isInteger(fiscalYear) === false) {
      throw new BadRequestError("invalid parameter")
    }

    const records = await new HealthCheckupRepository(c).find({
      employeeId: employeeId,
      fiscalYear: fiscalYear,
    })

    if (records instanceof Error) {
      throw new InternalError("internal error")
    }

    const responseBody = zAppHealthCheckupList.parse({
      data: records.map((record) => ({
        id: record.id,
        employee_id: record.employeeId,
        fiscal_year: record.fiscalYear,
        checkup_kind: record.checkupKind,
        conducted_on: record.conductedOn,
        status: record.status,
        note: record.note,
        created_at: record.createdAt,
      })),
      total: records.length,
    })

    return c.json(responseBody, 200)
  },
)

/** POST /health-checkups — 実施記録を作成する。health_checkup:manage が必要。結果カラムは受け取らない。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_id: z.number().int().positive(),
      fiscal_year: z.number().int(),
      checkup_kind: z.enum(["regular", "stress_check"]),
      conducted_on: isoDate.nullable().optional(),
      status: z.enum(["scheduled", "completed", "declined"]).optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("health_checkup:manage") === false) {
      throw new ForbiddenError()
    }

    const json = c.req.valid("json")

    const record = await new CreateHealthCheckup(c).run({
      employeeId: json.employee_id,
      fiscalYear: json.fiscal_year,
      checkupKind: json.checkup_kind,
      conductedOn: json.conducted_on ?? null,
      status: json.status ?? "scheduled",
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (record instanceof Error) {
      throw toHttpException(record)
    }

    const responseBody = zAppHealthCheckup.parse({
      id: record.id,
      employee_id: record.employeeId,
      fiscal_year: record.fiscalYear,
      checkup_kind: record.checkupKind,
      conducted_on: record.conductedOn,
      status: record.status,
      note: record.note,
      created_at: record.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
