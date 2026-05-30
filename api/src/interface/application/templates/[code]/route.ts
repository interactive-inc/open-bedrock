import { factory } from "@/lib/factory"
import { applicationTemplates } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { eq } from "drizzle-orm"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = c.req.param("code") ?? ""

  const rows = await c.var.database
    .select()
    .from(applicationTemplates)
    .where(eq(applicationTemplates.code, code))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("template not found")
  }

  const responseBody = {
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    schema_json: JSON.parse(row.schemaJson),
    approver_roles: JSON.parse(row.approverRoles),
  }

  return c.json(responseBody, 200)
})
