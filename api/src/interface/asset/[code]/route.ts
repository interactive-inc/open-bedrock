import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { assets } from "@/schema"
import { eq } from "drizzle-orm"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = c.req.param("code") ?? ""

  const rows = await c.var.database.select().from(assets).where(eq(assets.code, code)).limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("asset not found")
  }

  const responseBody = {
    code: row.code,
    name: row.name,
    kind: row.kind,
    serial: row.serial,
    purchased_on: row.purchasedOn,
    status: row.status,
    holder_employee_id: row.holderEmployeeId,
  }

  return c.json(responseBody, 200)
})
