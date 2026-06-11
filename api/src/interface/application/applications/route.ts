import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { applications, applicationTemplates } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { z } from "zod"

// GET /applications — 本人の申請一覧（ステータスで絞り込み可）
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

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

    const conditions: Array<SQL> = [eq(applications.applicantId, session.employeeId)]

    if (query.status !== undefined) {
      conditions.push(eq(applications.status, query.status))
    }

    const rows = await c.var.database
      .select({ application: applications, templateName: applicationTemplates.name })
      .from(applications)
      .leftJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)

    const responseBody = rows.map((row) => ({
      id: row.application.id,
      template_name: row.templateName ?? "",
      status: row.application.status,
      current_step: row.application.currentStep,
      created_at: row.application.createdAt,
    }))

    return c.json(responseBody, 200)
  },
)
