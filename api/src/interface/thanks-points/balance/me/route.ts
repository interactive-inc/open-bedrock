import { ViewMyBalance } from "@/application/thanks-points/view-my-balance"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

// GET /thanks/balance/me — 自分の受領残高（受領 − 確定交換）を取得する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const balance = await new ViewMyBalance(c).run({ employeeId: session.employeeId })

  if (balance instanceof Error) {
    throw new InternalError("failed to load balance")
  }

  return c.json({ balance_points: balance }, 200)
})
