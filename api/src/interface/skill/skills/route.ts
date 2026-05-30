import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { skills } from "@/schema"
import { and, eq, like, or } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const q = c.req.query("q") ?? null

  const category = c.req.query("category") ?? null

  const conditions: Array<SQL> = []

  if (q !== null) {
    const keyword = `%${q}%`

    const keywordMatch = or(like(skills.name, keyword), like(skills.code, keyword))

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

  const responseBody = rows.map((row) => ({
    code: row.code,
    name: row.name,
    category: row.category,
  }))

  return c.json(responseBody, 200)
})
