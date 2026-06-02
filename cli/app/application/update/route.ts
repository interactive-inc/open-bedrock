import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte application update --id <application-id> --payload <json>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      payload: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.payload) throw new UsageError("--id, --payload が必要です")

    const payload = toPayload(query.payload)

    if (payload instanceof Error) throw new UsageError("--payload は JSON で指定してください")

    const client = await createClient()

    const response = await client.applications[":id"].$put({
      param: { id: query.id },
      json: { payload: payload },
    })

    const application = await response.json()

    return c.json(application)
  },
)

// --payload の文字列を JSON へ。解析できなければ Error。
function toPayload(raw: string): unknown | Error {
  try {
    return JSON.parse(raw)
  } catch (error) {
    return error instanceof Error ? error : new Error("invalid payload json")
  }
}
