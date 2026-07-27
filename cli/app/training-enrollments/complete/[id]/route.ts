import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock training-enrollments complete <id> [--score <n>]`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), score: z.string().optional() })),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["training-enrollments"][":id"].complete.$post({
      param: { id: id },
      json: {
        score: query.score !== undefined ? toFiniteNumber(query.score, "--score") : undefined,
      },
    })

    const enrollment = await response.json()

    return c.json(enrollment)
  },
)
