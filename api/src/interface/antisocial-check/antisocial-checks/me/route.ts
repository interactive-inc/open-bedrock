import { ListMyAntisocialChecks } from "@/application/antisocial-check/list-my-antisocial-checks"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /antisocial-checks/me — 申請者本人の反社チェック申請一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const antisocialChecks = await new ListMyAntisocialChecks(c).run({
    requesterId: viewer.employeeId,
  })

  if (antisocialChecks instanceof Error) {
    throw new InternalError("failed to load antisocial checks")
  }

  const responseBody = antisocialChecks.map((antisocialCheck) => ({
    id: antisocialCheck.id,
    requester_id: antisocialCheck.requesterId,
    partner_name: antisocialCheck.partnerName,
    partner_address: antisocialCheck.partnerAddress,
    representative_name: antisocialCheck.representativeName,
    result: antisocialCheck.result,
    status: antisocialCheck.status,
    created_at: antisocialCheck.createdAt,
  }))

  return c.json(responseBody, 200)
})
