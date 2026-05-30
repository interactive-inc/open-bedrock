import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte app inbox — 承認待ち一覧`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(json(), async (c) => {
  if (c.req.valid("json").help) return c.text(help)

  const cols = ["id", "template_name", "applicant_name", "current_step", "status", "created_at"]

  const client = await createClient()

  const response = await client.applications.inbox.$get()

  const rows = await response.json()

  return c.text(
    table(
      cols,
      rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
      `承認待ち (${rows.length}件)`,
    ),
  )
})
