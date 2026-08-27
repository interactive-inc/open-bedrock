import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock certificate-requests issue --id <certificate-request-id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    const client = await createClient()

    const response = await client["certificate-request"]["certificate-requests"][":id"].issue.$post(
      {
        param: { id: query.id },
      },
    )

    if (response.status !== 200) {
      throw new UsageError("証明書発行依頼の発行に失敗しました")
    }

    const result = await response.json()

    return c.json(result)
  },
)
