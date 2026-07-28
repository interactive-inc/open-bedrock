import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { api } from "@/lib/http/client"

export const help = `bedrock governance review <code> --version <semver> --org-role <role> --decision approved|rejected [--comment <text>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      version: z.string().optional(),
      "org-role": z.string().optional(),
      decision: z.enum(["approved", "rejected"]).optional(),
      comment: z.string().max(2_000).optional(),
    }),
  ),
  zValidator("param", z.object({ code: z.string().optional() })),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    const code = c.req.valid("param").code ?? input.code
    if (!code || !input.version || !input["org-role"] || !input.decision) {
      throw new UsageError("code、--version、--org-role、--decision が必要です")
    }
    return c.json(
      await api(
        `/governance/documents/${encodeURIComponent(code)}/versions/${encodeURIComponent(input.version)}/review`,
        {
          method: "POST",
          json: {
            org_role_code: input["org-role"],
            decision: input.decision,
            comment: input.comment ?? null,
          },
        },
      ),
    )
  },
)
