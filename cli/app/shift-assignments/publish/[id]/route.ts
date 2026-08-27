import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock shift-assignments publish <id> — シフト割当を公開`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["shift"]["shift-assignments"][":id"].publish.$post({
      param: { id: id },
    })

    const assignment = await response.json()

    return c.json(assignment)
  },
)
