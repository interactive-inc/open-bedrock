import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte health-checkups complete <id> --conducted <date> — 実施記録を完了にし実施日を記録`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), conducted: z.string().optional() })),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    if (!query.conducted) throw new UsageError("--conducted <date> が必要です")

    const client = await createClient()

    const response = await client["health-checkups"][":id"].complete.$post({
      param: { id: id },
      json: { conducted_on: query.conducted },
    })

    const record = await response.json()

    return c.json(record)
  },
)
