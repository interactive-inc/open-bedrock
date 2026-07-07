import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { partners } from "@/schema"
import { eq } from "drizzle-orm"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppPartner } from "@/lib/app-schemas"
import { validateCodeParam } from "@/interface/shared/validate-code-param"

// GET /partners/:code — 取引先 1 件の詳細（台帳は社内公開）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "partner")

  const rows = await c.var.database.select().from(partners).where(eq(partners.code, code)).limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("partner not found")
  }

  const responseBody = zAppPartner.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    corporate_number: row.corporateNumber,
    note: row.note,
    status: row.status,
    created_at: row.createdAt,
  })

  return c.json(responseBody, 200)
})
