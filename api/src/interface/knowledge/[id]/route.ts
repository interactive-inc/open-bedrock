import { factory } from "@/lib/factory"
import { knowledgeArticles } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { BadRequestError, NotFoundError } from "@/interface/lib/errors"
import { eq } from "drizzle-orm"
import { z } from "zod"

const articleIdSchema = z.coerce.number().int().positive()

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const parsedId = articleIdSchema.safeParse(c.req.param("id"))

  if (parsedId.success === false) {
    throw new BadRequestError("invalid knowledge id")
  }

  const rows = await c.var.database
    .select()
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.id, parsedId.data))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("knowledge not found")
  }

  const responseBody = {
    id: row.id,
    title: row.title,
    category: row.category,
    tags: row.tags,
    body_md: row.bodyMd,
  }

  return c.json(responseBody, 200)
})
