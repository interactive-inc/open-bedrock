import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte asset list [--kind <k>] [--status <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      kind: z.string().optional(),
      status: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.assets.$get({
      query: { kind: query.kind, status: query.status },
    })

    const rows = await response.json()

    const cols = ["code", "name", "kind", "status", "holder_employee_id"]

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row] ?? ""))),
        `資産一覧 (${rows.length}件)`,
      ),
    )
  },
)
