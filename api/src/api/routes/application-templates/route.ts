import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import {
  InternalError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { zAppApplicationTemplateList } from "@/lib/app-schemas"
import { z } from "zod"
import { systemProcedureRepository } from "@/api/routes/application-templates/lib/system-procedure-route"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /templates — 申請テンプレート一覧（カテゴリで絞り込み可） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      category: z.string().optional(),
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

    const result = await systemProcedureRepository(c).listActive({
      category: query.category ?? null,
      limit,
      offset,
    })
    if (result instanceof Error) throw new InternalError("failed to list templates")

    const responseBody = zAppApplicationTemplateList.parse({
      data: result.definitions.map((definition) => ({
        code: definition.key,
        name: definition.title,
        category: definition.category,
        description: definition.description,
      })),
      total: result.total,
    })

    return c.json(responseBody, 200)
  },
)
