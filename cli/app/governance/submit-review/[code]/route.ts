import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { api } from "@/lib/http/client"

export const help = `bedrock governance submit-review <code> --version <semver>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      version: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ code: z.string().optional() })),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    const code = c.req.valid("param").code ?? input.code
    if (!code || !input.version) throw new UsageError("code と --version が必要です")
    return c.json(
      await api(
        `/governance/documents/${encodeURIComponent(code)}/versions/${encodeURIComponent(input.version)}/submit-review`,
        { method: "POST" },
      ),
    )
  },
)
