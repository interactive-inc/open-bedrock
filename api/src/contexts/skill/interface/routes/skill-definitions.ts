import { factory } from "@/contexts/company/interface/utils/factory"
import { likeKeyword } from "@/contexts/company/interface/utils/like-keyword"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppSkillList } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { skills } from "@/contexts/skill/infrastructure/schema/skill"
import { and, count, eq, or } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const q = c.req.query("q") ?? null

  const category = c.req.query("category") ?? null

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const conditions: Array<SQL> = []

  if (q !== null) {
    const keywordMatch = or(likeKeyword(skills.name, q), likeKeyword(skills.code, q))

    if (keywordMatch !== undefined) {
      conditions.push(keywordMatch)
    }
  }

  if (category !== null) {
    conditions.push(eq(skills.category, category))
  }

  const rows = await c.var.database
    .select()
    .from(skills)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(skills)
    .where(conditions.length === 0 ? undefined : and(...conditions))

  const responseBody = zAppSkillList.parse({
    data: rows.map((row) => ({
      code: row.code,
      name: row.name,
      category: row.category,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
