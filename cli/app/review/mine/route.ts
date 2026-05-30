import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte review mine — 自分の評価依頼一覧`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client["review-forms"].me.$get()

    const rows = await response.json()

    const cols = ["id", "cycle_id", "reviewer_type", "status", "score"]

    return c.text(
      table(
        cols,
        rows.map((row) => [row.id, row.cycle_id, row.reviewer_type, row.status, row.score]),
        `評価依頼一覧 (${rows.length}件)`,
      ),
    )
  },
)
