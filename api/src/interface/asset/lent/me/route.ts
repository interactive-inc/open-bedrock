import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { assets } from "@/schema"
import { and, eq } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

// GET /assets/lent/me — 本人が現在借り受けている資産一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .select()
    .from(assets)
    .where(and(eq(assets.status, "lent"), eq(assets.holderEmployeeId, session.employeeId)))

  const responseBody = rows.map((row) => ({
    code: row.code,
    name: row.name,
    kind: row.kind,
    serial: row.serial,
    purchased_on: row.purchasedOn,
    status: row.status,
    holder_employee_id: row.holderEmployeeId,
  }))

  return c.json(responseBody, 200)
})
