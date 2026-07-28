import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"

export const help = `bedrock onboarding-templates bind-lifecycle <template_code> --effect <hire|retired>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      template_code: z.string().optional(),
      effect: z.enum(["hire", "retired"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)

    const templateCode = c.req.param("template_code") ?? query.template_code
    if (!templateCode || !query.effect) {
      throw new UsageError("template_code と --effect が必要です")
    }

    const client = await createClient()
    const response = await client["onboarding-templates"][":code"]["lifecycle-binding"].$put({
      param: { code: templateCode },
      json: { effect_type: query.effect },
    })

    return c.json(await response.json())
  },
)
