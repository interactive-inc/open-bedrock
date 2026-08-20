import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { CompanyHttpError } from "@/contexts/company/interface/http/errors/company-http-error"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { readSystemBatchJobs } from "@system/infrastructure/batch/read-system-batch-jobs"
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
      throw new CompanyHttpError({
        status: 500,
        code: "batch_read_failed",
        detail: "バッチ実行状況を取得できませんでした。",
        cause: result,
      })
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
