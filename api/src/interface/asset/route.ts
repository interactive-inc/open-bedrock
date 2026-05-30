import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { assets } from "@/schema"
import { and, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

// GET /assets — kind / status で絞り込める資産一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const kind = c.req.query("kind") ?? null

  const status = c.req.query("status") ?? null

  const conditions: Array<SQL> = []

  if (kind !== null) {
    conditions.push(eq(assets.kind, kind))
  }

  if (status !== null) {
    conditions.push(eq(assets.status, status))
  }

  const rows = await c.var.database
    .select()
    .from(assets)
    .where(conditions.length === 0 ? undefined : and(...conditions))

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
