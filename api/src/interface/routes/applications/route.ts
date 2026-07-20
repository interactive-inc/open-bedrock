import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { applications, applicationTemplates } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppApplicationList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { z } from "zod"

/** GET /applications — 本人の申請一覧（ステータスで絞り込み可） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
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

    // 一覧では payload（大きい JSON 文字列）を返さないため、必要な列だけを取得する。
    const rows = await c.var.database
      .select({
        id: applications.id,
        status: applications.status,
        currentStep: applications.currentStep,
        createdAt: applications.createdAt,
        templateName: applicationTemplates.name,
      })
      .from(applications)
      .leftJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(applications)
      .where(and(...conditions))

    const responseBody = zAppApplicationList.parse({
      data: rows.map((row) => ({
        id: row.id,
        template_name: row.templateName ?? "",
        status: row.status,
        current_step: row.currentStep,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
