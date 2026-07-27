import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock performance-goals update --id <goal-id> --period <p> --title <t> [--weight <n>] [--kpi <k>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      period: z.string().optional(),
      title: z.string().optional(),
      weight: z.string().optional(),
      kpi: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.period || !query.title)
      throw new UsageError("--id, --period, --title が必要です")

    const client = await createClient()

    const response = await client["performance-goals"][":goal_id"].$put({
      param: { goal_id: query.id },
      json: {
        period: query.period,
        title: query.title,
        weight: query.weight ? toFiniteNumber(query.weight, "--weight") : 10,
        kpi: query.kpi ?? null,
      },
    })

    const goal = await response.json()

    return c.json(goal)
  },
)
