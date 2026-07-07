import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte audit-logs — 監査ログ一覧（audit_log:read が必要）

usage:
  karte audit-logs [--actor-account-id <id>] [--action <action>] [--target-type <type>]
                   [--from <date>] [--to <date>] [--limit <n>] [--offset <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "actor-account-id": z.string().optional(),
      action: z.string().optional(),
      "target-type": z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["audit-logs"].$get({
      query: {
        actor_account_id: query["actor-account-id"],
        action: query.action,
        target_type: query["target-type"],
        from: query.from,
        to: query.to,
        limit: query.limit,
        offset: query.offset,
      },
    })

    const body = await response.json()

    return c.json(body)
  },
)
