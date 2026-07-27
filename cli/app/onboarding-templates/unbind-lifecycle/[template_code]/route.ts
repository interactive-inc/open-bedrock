import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"

export const help = `bedrock onboarding-templates unbind-lifecycle <template_code>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), template_code: z.string().optional() }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const templateCode = c.req.param("template_code") ?? query.template_code
    if (!templateCode) throw new UsageError("template_code が必要です")

    const client = await createClient()
    await client["onboarding-templates"][":code"]["lifecycle-binding"].$delete({
      param: { code: templateCode },
    })
    return c.json({ removed: true })
  },
)
