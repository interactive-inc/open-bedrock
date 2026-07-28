import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock headcount-plans update <id> --planned-count <n> [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "planned-count": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    if (!query["planned-count"]) throw new UsageError("--planned-count が必要です")

    const plannedCount = toFiniteNumber(query["planned-count"], "--planned-count")

    const client = await createClient()

    const response = await client["headcount-plans"][":id"].$put({
      param: { id },
      json: { planned_count: plannedCount, note: query.note ?? null },
    })

    return c.json(await response.json())
  },
)
