import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte 1on1 edit --id <one-on-one-id> [--topics <t>] [--manager-note <n>] [--next-action <a>] — 記録内容を変更`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      topics: z.string().optional(),
      "manager-note": z.string().optional(),
      "next-action": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    const client = await createClient()

    const response = await client.oneonone[":id"].$put({
      param: { id: query.id },
      json: {
        topics: query.topics ?? null,
        manager_note: query["manager-note"] ?? null,
        next_action: query["next-action"] ?? null,
      },
    })

    const oneOnOne = await response.json()

    return c.json(oneOnOne)
  },
)
