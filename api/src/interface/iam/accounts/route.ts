import { ListAccounts } from "@/application/iam/list-accounts"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppAccountList } from "@/lib/app-schemas"

// GET /accounts — アカウント一覧（account:manage が必要）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new ListAccounts(c).run({ session: session })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppAccountList.parse({
    data: result.map((account) => ({
      id: account.id,
      employee_id: account.employeeId,
      employee_name: account.employeeName,
      status: account.status,
      role_keys: [...account.roleKeys],
    })),
    total: result.length,
  })

  return c.json(responseBody, 200)
})
