import { CloseStocktake } from "@/application/stocktake/close-stocktake"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { StocktakeRepository } from "@/infrastructure/stocktake/stocktake-repository"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppStocktake } from "@/lib/app-schemas"
import { validateUuidParam } from "@/interface/utils/validate-uuid-param"

/** POST /stocktakes/:id/close — 棚卸しセッションを締める（権限が必要） */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const id = validateUuidParam(c.req.param("id"), "stocktake")

  const closed = await new CloseStocktake(c).run({
    session: session,
    id: id,
    now: c.env.NOW ?? new Date().toISOString(),
  })

  if (closed instanceof ApplicationError) {
    throw toHttpException(closed)
  }

  const repository = new StocktakeRepository(c)

  const counts = await repository.countsFor(id)

  if (counts instanceof Error) {
    throw counts
  }

  const items = await repository.itemsFor(id)

  if (items instanceof Error) {
    throw items
  }

  const responseBody = zAppStocktake.parse({
    id: closed.id,
    name: closed.name,
    target_date: closed.targetDate,
    status: closed.status,
    created_at: closed.createdAt,
    closed_at: closed.closedAt,
    checked_count: counts.checkedCount,
    total_count: counts.totalCount,
    items: items.map((item) => ({
      asset_code: item.assetCode,
      asset_name: item.assetName,
      kind: item.kind,
      checked_at: item.checkedAt,
      checker_employee_id: item.checkerEmployeeId,
      location_note: item.locationNote,
    })),
  })

  return c.json(responseBody, 200)
})
