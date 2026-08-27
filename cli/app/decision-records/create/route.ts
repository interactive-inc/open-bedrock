import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock decision-records create --title <t> --decided-on <d> --context <c> --decision <dc> [--consequences <cq>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      "decided-on": z.string().optional(),
      context: z.string().optional(),
      decision: z.string().optional(),
      consequences: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const decidedOn = query["decided-on"]

    if (!query.title || !decidedOn || !query.context || !query.decision)
      throw new UsageError("--title, --decided-on, --context, --decision が必要です")

    const client = await createClient()

    const response = await client["meeting"]["decision-records"].$post({
      json: {
        title: query.title,
        decided_on: decidedOn,
        context: query.context,
        decision: query.decision,
        consequences: query.consequences ?? null,
      },
    })

    return c.json(await response.json())
  },
)
