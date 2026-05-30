import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { readJsonFile } from "@/lib/io/read-json"
import { pretty } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte app submit <code> --data <file>`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(
  json(),
  zValidator("param", z.object({ template_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const templateCode = c.req.valid("param").template_code

    if (!templateCode) throw new UsageError("引数 <code> が必要です")

    if (!query.data) throw new UsageError("--data <file> が必要です")

    const payload = await readJsonFile(query.data as string)

    const client = await createClient()

    const response = await client.applications.$post({
      json: { template_code: templateCode, payload },
    })

    return c.text(pretty(await response.json()))
  },
)
