import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { surveys } from "@/schema"
import { eq } from "drizzle-orm"

// GET /surveys — 公開中のアンケート一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .select()
    .from(surveys)
    .where(eq(surveys.status, "open"))
    .orderBy(surveys.id)

  const responseBody = rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    questions_json: JSON.parse(row.questionsJson),
  }))

  return c.json(responseBody, 200)
})
