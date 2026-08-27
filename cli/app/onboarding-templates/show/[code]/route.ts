import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock onboarding-templates show <code> — オンボーディングテンプレート詳細`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const code = c.req.valid("param").code

    if (!code) throw new UsageError("引数 <code> が必要です")

    const client = await createClient()

    const response = await client["onboarding"]["onboarding-templates"][":code"].$get({
      param: { code: code },
    })

    const template = await response.json()

    return c.json(template)
  },
)
