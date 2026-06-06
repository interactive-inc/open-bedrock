import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte thanks send --to <employee_code> --message <m> [--points <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      to: z.string().optional(),
      message: z.string().optional(),
      points: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.to || !query.message) throw new UsageError("--to と --message が必要です")

    const points = toPoints(query.points)

    if (points instanceof Error) throw new UsageError(points.message)

    const client = await createClient()

    const response = await client.thanks.$post({
      json: {
        recipient_employee_code: query.to,
        message: query.message,
        points,
      },
    })

    return c.json(await response.json())
  },
)

// --points を 0 以上の整数に変換する。未指定は null（メッセージのみの感謝）。
function toPoints(raw: string | undefined): number | null | Error {
  if (raw === undefined) {
    return null
  }

  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false || parsed < 0) {
    return new Error("--points は 0 以上の整数で指定してください")
  }

  return parsed
}
