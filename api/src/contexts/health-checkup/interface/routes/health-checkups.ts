import { CreateHealthCheckup } from "@/contexts/health-checkup/application/create-health-checkup"
import { HealthCheckupRepository } from "@/contexts/health-checkup/infrastructure/health-checkup.repository"
import { factory } from "@/api/http/factory"
import { isoDate } from "@/lib/schemas"
import { zAppHealthCheckup, zAppHealthCheckupList } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/http/errors"
import { resolveEmployeeIdFromBody } from "@/api/http/utils/resolve-employee-id-from-body"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
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

// @authorization permission - 権限キーで判定する
/** POST /health-checkups — 実施記録を作成する。health_checkup:manage が必要。結果カラムは受け取らない。対象は employee_id / employee_code のいずれかで指定する */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        employee_id: z.number().int().positive().optional(),
        employee_code: z.string().min(1).max(200).optional(),
        fiscal_year: z.number().int(),
        checkup_kind: z.enum(["regular", "stress_check"]),
        conducted_on: isoDate.nullable().optional(),
        status: z.enum(["scheduled", "completed", "declined"]).optional(),
        note: z.string().max(3_000).nullable().optional(),
      })
      .refine((json) => (json.employee_id === undefined) !== (json.employee_code === undefined), {
        message: "specify exactly one of employee_id or employee_code",
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

    const targetEmployeeId = await resolveEmployeeIdFromBody({
      c,
      employeeId: json.employee_id,
      employeeCode: json.employee_code,
    })

    if (targetEmployeeId instanceof Error) {
      throw new InternalError("failed to resolve target employee")
    }

    if (targetEmployeeId === null) {
      throw new NotFoundError("employee not found")
    }

    const record = await new CreateHealthCheckup(c).run({
      employeeId: targetEmployeeId,
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
