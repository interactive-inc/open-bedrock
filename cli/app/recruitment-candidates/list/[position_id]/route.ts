import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock recruitment-candidates list <position_id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ position_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const positionId = c.req.valid("param").position_id

    if (!positionId) throw new UsageError("引数 <position_id> が必要です")

    const client = await createClient()

    const response = await client["job-openings"][":jobOpeningId"].candidates.$get({
      param: { jobOpeningId: positionId },
    })

    return c.json(await response.json())
  },
)
