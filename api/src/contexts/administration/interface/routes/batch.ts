import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { AdministrationBatchUnavailableError } from "@/contexts/administration/interface/errors/administration-batch-unavailable-error.error"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { readSystemBatchJobs } from "@system/infrastructure/batch/read-system-batch-jobs.repository"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("batch:view") === false) {
      throw new ForbiddenError()
    }

    const parsed = c.req.valid("query")

    const limit = toBoundedInt({
      raw: parsed.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: parsed.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const result = await readSystemBatchJobs({ env: { DB: c.env.DB } }, { limit, offset })
    if (result instanceof Error) {
      throw new AdministrationBatchUnavailableError(result)
    }

    const responseBody = result.jobs.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      started_at: row.startedAt,
      finished_at: row.finishedAt,
      message: row.message,
    }))

    return c.json({ data: responseBody, total: result.total }, 200)
  },
)
