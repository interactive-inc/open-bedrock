import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte survey list — オープン中のアンケート`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.surveys.$get()

    const rows = await response.json()

    return c.text(
      table(
        ["id", "title", "status", "questions"],
        rows.map((row) => [
          String(row.id),
          String(row.title),
          String(row.status),
          String(row.questions_json.length),
        ]),
        `オープン中のアンケート (${rows.length}件)`,
      ),
    )
  },
)
