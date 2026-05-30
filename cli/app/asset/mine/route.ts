import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte asset mine — 自分の貸与品`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.assets.lent.me.$get()

    const rows = await response.json()

    const cols = ["code", "name", "kind", "status"]

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row] ?? ""))),
        `自分の貸与品 (${rows.length}件)`,
      ),
    )
  },
)
