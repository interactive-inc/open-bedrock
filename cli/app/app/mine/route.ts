import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte app mine [--status <s>]`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(json(), async (c) => {
  const query = c.req.valid("json")

  if (query.help) return c.text(help)

  const cols = ["id", "template_name", "status", "current_step", "created_at"]

  const client = await createClient()

  const response = await client.applications.$get({
    query: { status: query.status as string | undefined },
  })

  const rows = await response.json()

  return c.text(
    table(
      cols,
      rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
      `自分の申請 (${rows.length}件)`,
    ),
  )
})
