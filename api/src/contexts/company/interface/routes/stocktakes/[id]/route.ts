import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { StocktakeRepository } from "@/contexts/company/infrastructure/stocktake/stocktake-repository"
import { NotFoundError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppStocktake } from "@/lib/app-schemas"
import { validateUuidParam } from "@/contexts/company/interface/utils/validate-uuid-param"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /stocktakes/:id — 棚卸しセッションの詳細（対象資産ごとの確認状況を含む） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const id = validateUuidParam(c.req.param("id"), "stocktake")

  const repository = new StocktakeRepository(c)

  const stocktake = await repository.findById(id)

  if (stocktake instanceof Error) {
    throw stocktake
  }

  if (stocktake === null) {
    throw new NotFoundError("stocktake not found")
  }

  const counts = await repository.countsFor(id)

  if (counts instanceof Error) {
    throw counts
  }

  const items = await repository.itemsFor(id)

  if (items instanceof Error) {
    throw items
  }

  const responseBody = zAppStocktake.parse({
    id: stocktake.id,
    name: stocktake.name,
    target_date: stocktake.targetDate,
    status: stocktake.status,
    created_at: stocktake.createdAt,
    closed_at: stocktake.closedAt,
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
