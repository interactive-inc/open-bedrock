import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte app templates — 申請テンプレート一覧`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(json(), async (c) => {
  const query = c.req.valid("json")

  if (query.help) return c.text(help)

  const cols = ["code", "name", "category", "description"]

  const client = await createClient()

  const response = await client.templates.$get({
    query: { category: query.category as string | undefined },
  })

  const rows = await response.json()

  return c.text(
    table(
      cols,
      rows.map((row) => [
        String(row.code),
        String(row.name),
        String(row.category),
        String(row.description ?? "").slice(0, 40),
      ]),
      `申請テンプレート (${rows.length}件)`,
    ),
  )
})
