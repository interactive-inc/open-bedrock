import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { partners } from "@/contexts/partner/infrastructure/schema/partner"
import { eq } from "drizzle-orm"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { zAppPartner } from "@/contexts/partner/interface/http/response-schemas"
import { validateCodeParam } from "@/lib/http/validate-code-param"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /partners/:code — 取引先 1 件の詳細（台帳は社内公開） */
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
