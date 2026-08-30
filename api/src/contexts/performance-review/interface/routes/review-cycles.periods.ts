import { UnauthorizedError } from "@/lib/http/errors"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { reviewCycles } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { zAppReviewPeriodList } from "@/contexts/performance-review/interface/http/response-schemas"
import { asc } from "drizzle-orm"

// @authorization authenticated - 期間ラベルだけを返すので、ログインしていれば誰でも読める
/**
 * GET /review-cycles/periods — 評価期間ラベルの一覧
 *
 * 目標の期間選択に使う read model。`GET /review-cycles` は `review:administer` が無いと
 * open のサイクルだけに絞るため、一般の従業員からは今期がまだ draft の間だけ期間が消える。
 * 期間ラベルは目標を登録する全員に必要なので、status で絞らずに返す。
 *
 * title / status / due_date は返さない。まだ open していないサイクルの表題や締切まで
 * 全従業員へ広げる必要はないため、期間ラベルだけに絞る。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .selectDistinct({ period: reviewCycles.period })
    .from(reviewCycles)
    .orderBy(asc(reviewCycles.period))

  const responseBody = zAppReviewPeriodList.parse({
    data: rows.map((row) => row.period),
  })

  return c.json(responseBody, 200)
})
