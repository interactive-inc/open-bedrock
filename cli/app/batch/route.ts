import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte batch — バッチ状況を表示`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.batch.$get()

    const rows = await response.json()

    const cols = ["id", "name", "status", "started_at", "finished_at", "message"]

    return c.text(
      table(
        cols,
        rows.map((row) => [
          String(row.id),
          String(row.name),
          String(row.status),
          String(row.started_at ?? "").slice(0, 19),
          String(row.finished_at ?? "").slice(0, 19),
          String(row.message ?? "").slice(0, 40),
        ]),
        `バッチ状況 (${rows.length}件)`,
      ),
    )
  },
)
