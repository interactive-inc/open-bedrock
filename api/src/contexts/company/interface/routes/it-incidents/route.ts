import { CreateItIncident } from "@/contexts/company/application/it-incident/create-it-incident"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ItIncidentRepository } from "@/contexts/company/infrastructure/it-incident/it-incident-repository"
import { ApplicationError } from "@/lib/errors"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppItIncident, zAppItIncidentList } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /it-incidents — 全社のインシデント記録（it_incident:read:all）。発生日時の新しい順。 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["open", "resolved"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("it_incident:read:all") === false) {
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

    const repository = new ItIncidentRepository(c)

    const incidents = await repository.findAll({ status, limit, offset })

    if (incidents instanceof Error) {
      throw new InternalError("failed to load it incidents")
    }

    const total = await repository.count(status)

    if (total instanceof Error) {
      throw new InternalError("failed to count it incidents")
    }

    const responseBody = zAppItIncidentList.parse({
      data: incidents.map((incident) => ({
        id: incident.id,
        occurred_at: incident.occurredAt,
        title: incident.title,
        summary: incident.summary,
        severity: incident.severity,
        status: incident.status,
        resolved_at: incident.resolvedAt,
        created_at: incident.createdAt,
      })),
      total,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** POST /it-incidents — インシデント記録を新規登録（it_incident:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      occurred_at: z.string().min(1).max(100),
      title: z.string().min(1).max(300),
      summary: z.string().min(1).max(5_000),
      severity: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateItIncident(c).run({
      session,
      incident: {
        occurredAt: json.occurred_at,
        title: json.title,
        summary: json.summary,
        severity: json.severity ?? null,
      },
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppItIncident.parse({
      id: created.id,
      occurred_at: created.occurredAt,
      title: created.title,
      summary: created.summary,
      severity: created.severity,
      status: created.status,
      resolved_at: created.resolvedAt,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
