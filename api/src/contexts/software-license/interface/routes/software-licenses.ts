import { CreateLicense } from "@/contexts/software-license/application/license/create-license"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/license/license-repository"
import { ApplicationError } from "@/lib/errors"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppLicense, zAppLicenseList } from "@/lib/app-schemas"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /software-licenses — 全社のライセンス・SaaS 台帳（license:read:all）。更新期限が近い順（NULL は末尾）。 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["active", "cancelled"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("license:read:all") === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const status = query.status ?? null

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const repository = new LicenseRepository(c)

    const licenses = await repository.findAll({ status, limit, offset })

    if (licenses instanceof Error) {
      throw new InternalError("failed to load licenses")
    }

    const total = await repository.count(status)

    if (total instanceof Error) {
      throw new InternalError("failed to count licenses")
    }

    const responseBody = zAppLicenseList.parse({
      data: licenses.map((license) => ({
        id: license.id,
        name: license.name,
        vendor: license.vendor,
        category: license.category,
        seats: license.seats,
        renewal_deadline: license.renewalDeadline,
        owner_employee_id: license.ownerEmployeeId,
        note: license.note,
        status: license.status,
        created_at: license.createdAt,
      })),
      total,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** POST /software-licenses — ライセンス台帳を新規登録（license:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(300),
      vendor: z.string().max(300).nullable().optional(),
      category: z.enum(["saas", "software", "other"]).nullable().optional(),
      seats: z.number().int().nonnegative().nullable().optional(),
      renewal_deadline: isoDate.nullable().optional(),
      owner_employee_id: z.number().int().positive().nullable().optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateLicense(c).run({
      session,
      license: {
        name: json.name,
        vendor: json.vendor ?? null,
        category: json.category ?? null,
        seats: json.seats ?? null,
        renewalDeadline: json.renewal_deadline ?? null,
        ownerEmployeeId: json.owner_employee_id ?? null,
        note: json.note ?? null,
      },
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppLicense.parse({
      id: created.id,
      name: created.name,
      vendor: created.vendor,
      category: created.category,
      seats: created.seats,
      renewal_deadline: created.renewalDeadline,
      owner_employee_id: created.ownerEmployeeId,
      note: created.note,
      status: created.status,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
