import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock batch migrate-password-hashes — 旧形式パスワードハッシュを PBKDF2 ラップに一括移行`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.batch["migrate-password-hashes"].$post()

    const result = await response.json()

    return c.json(result)
  },
)
