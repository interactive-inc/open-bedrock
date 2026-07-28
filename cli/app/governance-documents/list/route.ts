import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { api } from "@/lib/http/client"

export const help = `bedrock governance-documents list [--q <text>] [--kind policy|procedure|guideline|control]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      q: z.string().max(200).optional(),
      kind: z.enum(["policy", "procedure", "guideline", "control"]).optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    return c.json(await api("/governance-documents", { query: { q: input.q, kind: input.kind } }))
  },
)
