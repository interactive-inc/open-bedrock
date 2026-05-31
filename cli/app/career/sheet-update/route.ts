import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { readJsonFile } from "@/lib/io/read-json"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte career sheet-update --data <file>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), data: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.data) throw new UsageError("--data <file> が必要です")

    const payload = await readJsonFile(query.data)

    const client = await createClient()

    const response = await client.career.sheet.me.$put({ json: payload })

    const sheet = await response.json()

    return c.json(sheet)
  },
)
