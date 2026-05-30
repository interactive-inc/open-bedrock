import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte skill mine — 自分のスキル`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.skills.me.$get()

    const rows = await response.json()

    const cols = ["skill_code", "skill_name", "skill_category", "level", "years"]

    return c.text(
      table(
        ["skill_code", "skill_name", "category", "level", "years"],
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `自分のスキル (${rows.length}件)`,
      ),
    )
  },
)
