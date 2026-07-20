import { CreateWorkAccident } from "@/application/work-accident/create-work-accident"
import { WorkAccidentRepository } from "@/infrastructure/work-accident/work-accident-repository"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { zAppWorkAccident, zAppWorkAccidentList } from "@/lib/app-schemas"
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
 * GET /work-accidents?status=&employee_id= — 労災・事故の発生記録一覧。
 * 個人が横断で見るものではないため work_accident:read:all を持つロールのみ許可（本人閲覧の概念はない）。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.string().optional(),
      employee_id: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("work_accident:read:all") === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const status = query.status !== undefined && query.status !== "" ? query.status : undefined

    const employeeId =
      query.employee_id !== undefined && query.employee_id !== ""
        ? Number(query.employee_id)
        : undefined

    if (employeeId !== undefined && Number.isInteger(employeeId) === false) {
      throw new BadRequestError("invalid parameter")
    }

    const records = await new WorkAccidentRepository(c).find({ status, employeeId })

    if (records instanceof Error) {
      throw new InternalError("internal error")
    }

    const responseBody = zAppWorkAccidentList.parse({
      data: records.map((record) => ({
        id: record.id,
        occurred_on: record.occurredOn,
        employee_id: record.employeeId,
        location: record.location,
        summary: record.summary,
        severity: record.severity,
        status: record.status,
        created_at: record.createdAt,
      })),
      total: records.length,
    })

    return c.json(responseBody, 200)
  },
)

/** POST /work-accidents — 発生記録を作成する。work_accident:manage が必要。employee_id は任意（対象者不特定可）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      occurred_on: isoDate,
      employee_id: z.number().int().positive().nullable().optional(),
      location: z.string().max(500).nullable().optional(),
      summary: z.string().min(1).max(3_000),
      severity: z.enum(["minor", "serious"]).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("work_accident:manage") === false) {
      throw new ForbiddenError()
    }

    const json = c.req.valid("json")

    const record = await new CreateWorkAccident(c).run({
      occurredOn: json.occurred_on,
      employeeId: json.employee_id ?? null,
      location: json.location ?? null,
      summary: json.summary,
      severity: json.severity ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (record instanceof Error) {
      throw toHttpException(record)
    }

    const responseBody = zAppWorkAccident.parse({
      id: record.id,
      occurred_on: record.occurredOn,
      employee_id: record.employeeId,
      location: record.location,
      summary: record.summary,
      severity: record.severity,
      status: record.status,
      created_at: record.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
