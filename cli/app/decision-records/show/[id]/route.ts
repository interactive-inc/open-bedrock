import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock decision-records show <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["decision-records"][":id"].$get({ param: { id } })

    const decision = await response.json()

    if ("context" in decision === false) {
      return c.json(decision)
    }

    return c.text(
      [
        `== ${decision.title} ==`,
        `decided_on=${decision.decided_on} status=${decision.status}`,
        "",
        "# Context",
        decision.context,
        "",
        "# Decision",
        decision.decision,
        "",
        "# Consequences",
        decision.consequences ?? "",
      ].join("\n"),
    )
  },
)
