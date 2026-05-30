import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte 1on1 list — 1on1 履歴`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.oneonone.$get()

    const rows = await response.json()

    const cols = ["id", "held_at", "member_name", "manager_name", "topics"]

    return c.text(
      table(
        cols,
        rows.map((row) => [
          String(row.id),
          String(row.held_at ?? "").slice(0, 16),
          String(row.member_name ?? ""),
          String(row.manager_name ?? ""),
          String(row.topics ?? "").slice(0, 30),
        ]),
        `1on1 履歴 (${rows.length}件)`,
      ),
    )
  },
)
