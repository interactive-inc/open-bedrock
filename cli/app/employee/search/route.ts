import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte employee search — 社員検索`

const COLS = ["code", "name", "dept_name", "position", "email", "status", "role"]

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      q: z.string().optional(),
      dept: z.string().optional(),
      status: z.enum(["active", "leave", "retired"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.employees.$get({
      query: { q: query.q, dept: query.dept, status: query.status },
    })

    const rows = await response.json()

    return c.text(
      table(
        COLS,
        rows.map((row) => COLS.map((col) => String(row[col as keyof typeof row]))),
        `社員検索結果 (${rows.length}件)`,
      ),
    )
  },
)
