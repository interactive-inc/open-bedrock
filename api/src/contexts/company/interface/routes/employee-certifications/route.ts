import { CreateEmployeeCertification } from "@/contexts/company/application/certification/create-employee-certification"
import { EmployeeCertificationRepository } from "@/contexts/company/infrastructure/certification/employee-certification-repository"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { zAppEmployeeCertification, zAppEmployeeCertificationList } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/**
 * GET /employee-certifications?employee_id= — 従業員の資格保有記録一覧。
 * 本人分は誰でも、他人分は certification:read:all を持つロールのみ閲覧できる。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ employee_id: z.string().optional() })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const requestedId =
      query.employee_id !== undefined && query.employee_id !== ""
        ? Number(query.employee_id)
        : session.employeeId

    if (Number.isInteger(requestedId) === false) {
      throw new BadRequestError("invalid parameter")
    }

    const isSelf = requestedId === session.employeeId

    if (isSelf === false && session.hasPermission("certification:read:all") === false) {
      throw new ForbiddenError()
    }

    const records = await new EmployeeCertificationRepository(c).findByEmployeeId(requestedId)

    if (records instanceof Error) {
      throw new InternalError("internal error")
    }

    const responseBody = zAppEmployeeCertificationList.parse({
      data: records.map((record) => ({
        id: record.id,
        employee_id: record.employeeId,
        certification_id: record.certificationId,
        acquired_on: record.acquiredOn,
        expires_on: record.expiresOn,
        note: record.note,
        created_at: record.createdAt,
      })),
      total: records.length,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization permission - 権限キーで判定する
/** POST /employee-certifications — 資格保有記録を作成する。certification:manage が必要。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_id: z.number().int().positive(),
      certification_id: z.number().int().positive(),
      acquired_on: isoDate,
      expires_on: isoDate.nullable().optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("certification:manage") === false) {
      throw new ForbiddenError()
    }

    const json = c.req.valid("json")

    const record = await new CreateEmployeeCertification(c).run({
      employeeId: json.employee_id,
      certificationId: json.certification_id,
      acquiredOn: json.acquired_on,
      expiresOn: json.expires_on ?? null,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (record instanceof Error) {
      throw toHttpException(record)
    }

    const responseBody = zAppEmployeeCertification.parse({
      id: record.id,
      employee_id: record.employeeId,
      certification_id: record.certificationId,
      acquired_on: record.acquiredOn,
      expires_on: record.expiresOn,
      note: record.note,
      created_at: record.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
