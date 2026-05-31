import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte app templates — 申請テンプレート一覧

usage:
  karte app templates [--category <category>]

詳細は karte app template <code> で確認できます。`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(json(), async (c) => {
  const query = c.req.valid("json")

  if (query.help) return c.text(help)

  const client = await createClient()

  const response = await client.templates.$get({
    query: { category: query.category as string | undefined },
  })

  const rows = await response.json()

  return c.json(rows)
})
