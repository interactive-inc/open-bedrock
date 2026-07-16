import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { api } from "@/lib/http/client"

export const help = `karte governance assign-role <role> --employee <code> --starts-on <date> [--department <code>] [--ends-on <date>] [--source-document <code>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      employee: z.string().optional(),
      department: z.string().optional(),
      "starts-on": z.string().optional(),
      "ends-on": z.string().optional(),
      "source-document": z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ code: z.string().optional() })),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    const code = c.req.valid("param").code ?? input.code
    if (!code || !input.employee || !input["starts-on"]) {
      throw new UsageError("role、--employee、--starts-on が必要です")
    }
    return c.json(
      await api(`/governance/org-roles/${encodeURIComponent(code)}/assignments`, {
        method: "POST",
        json: {
          employee_code: input.employee,
          department_code: input.department ?? null,
          starts_on: input["starts-on"],
          ends_on: input["ends-on"] ?? null,
          source_document_code: input["source-document"] ?? null,
        },
      }),
    )
  },
)
