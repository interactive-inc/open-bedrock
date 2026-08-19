import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock performance-goals show --id <goal-id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    const client = await createClient()

    const response = await client["performance-goals"][":goalId"].$get({
      param: { goalId: query.id },
    })

    const goal = await response.json()

    const evaluationsResponse = await client["performance-goals"][":goalId"].evaluations.$get({
      param: { goalId: query.id },
    })

    const evaluations = await evaluationsResponse.json()

    return c.json({ ...goal, evaluations })
  },
)
