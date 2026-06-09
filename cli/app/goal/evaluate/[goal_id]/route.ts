import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte goal evaluate <id> --kind self|manager|final [--score <n>] [--comment <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      kind: z.enum(["self", "manager", "final"]).optional(),
      score: z.string().optional(),
      comment: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ goal_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const goalId = c.req.valid("param").goal_id

    if (!goalId) throw new UsageError("引数 <id> が必要です")

    if (!query.kind) throw new UsageError("--kind が必要です (self|manager|final)")

    const client = await createClient()

    const response = await client.goals[":goal_id"].evaluations.$post({
      param: { goal_id: goalId },
      json: {
        kind: query.kind,
        score: query.score !== undefined ? toFiniteNumber(query.score, "--score") : undefined,
        comment: query.comment,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
