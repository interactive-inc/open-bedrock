import { factory } from "@/lib/factory"
import { toPrimaryRole } from "@/lib/auth/to-primary-role"
import { zAppAuthMe } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { employees } from "@/schema"
import { eq } from "drizzle-orm"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"

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

  // email は認証情報(identities)が正。本人の id から解決する。
  const emailByEmployeeId = await new IdentityRepository(c).findEmailsByEmployeeIds([row.id])

  if (emailByEmployeeId instanceof Error) {
    throw new InternalError("internal server error")
  }

  const responseBody = zAppAuthMe.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    email: emailByEmployeeId.get(row.id) ?? "",
    // レスポンス互換: 単一 role は roleKeys の代表値から導出する。
    role: toPrimaryRole(session.roleKeys),
    dept_name: row.deptName,
    position: row.position,
    permissions: [...session.permissions],
    role_keys: [...session.roleKeys],
  })

  return c.json(responseBody, 200)
})
