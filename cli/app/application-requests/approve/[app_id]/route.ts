import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { ensureOk } from "@/lib/http/ensure-ok"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock application-requests approve <id> [--comment <c>]`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(
  json(),
  zValidator("param", z.object({ app_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const appId = c.req.valid("param").app_id

    if (!appId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["application-requests"][":id"].approve.$post({
      param: { id: appId },
      json: { comment: (query.comment ?? null) as string | null },
    })

    await ensureOk(response)

    const result = await response.json()

    return c.text(`approved id=${appId} status=${result.status}`)
  },
)
