import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte goal create --period <p> --title <t> [--kpi <k>] [--weight <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      period: z.string().optional(),
      title: z.string().optional(),
      kpi: z.string().optional(),
      weight: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.period || !query.title) throw new UsageError("--period と --title が必要です")

    const client = await createClient()

    const response = await client.goals.$post({
      json: {
        period: query.period,
        title: query.title,
        weight: query.weight ? toFiniteNumber(query.weight, "--weight") : 10,
        kpi: query.kpi,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
