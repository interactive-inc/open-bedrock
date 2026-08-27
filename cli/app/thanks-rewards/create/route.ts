import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock thanks-rewards create --name <n> --cost <pt> [--stock <n>] — カタログ登録（管理者）`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      cost: z.string().optional(),
      stock: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.name || !query.cost) throw new UsageError("--name と --cost が必要です")

    const cost = Number(query.cost)

    if (Number.isInteger(cost) === false || cost <= 0) {
      throw new UsageError("--cost は正の整数で指定してください")
    }

    const stock = toStock(query.stock)

    if (stock instanceof Error) throw new UsageError(stock.message)

    const client = await createClient()

    const response = await client["thanks"]["thanks-rewards"].$post({
      json: { name: query.name, point_cost: cost, stock },
    })

    return c.json(await response.json())
  },
)

/** --stock を 0 以上の整数に変換する。未指定は null（在庫無制限）。 */
function toStock(raw: string | undefined): number | null | Error {
  if (raw === undefined) {
    return null
  }

  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false || parsed < 0) {
    return new Error("--stock は 0 以上の整数で指定してください")
  }

  return parsed
}
