import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte onboarding templates [--kind join|leave]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      kind: z.enum(["join", "leave"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.onboarding.templates.$get({
      query: { kind: query.kind },
    })

    const rows = await response.json()

    const cols = ["code", "name", "kind", "task_count"]

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `オンボーディングテンプレ (${rows.length}件)`,
      ),
    )
  },
)
