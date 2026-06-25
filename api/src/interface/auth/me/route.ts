import { factory } from "@/lib/factory"
import { zAppAuthMe } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees } from "@/schema"
import { eq } from "drizzle-orm"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"

// GET /me — 認証済みの本人の社員情報
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .select()
    .from(employees)
    .where(eq(employees.id, session.employeeId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("employee not found")
  }

  const responseBody = zAppAuthMe.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    role: row.role,
    dept_name: row.deptName,
    position: row.position,
  })

  return c.json(responseBody, 200)
})
