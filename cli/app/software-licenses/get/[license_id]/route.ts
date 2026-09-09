import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock software-licenses get <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).strict()),
  zValidator(
    "param",
    z.object({
      license_id: z
        .string()
        .regex(/^[1-9]\d*$/)
        .refine((value) => Number.isSafeInteger(Number(value)))
        .optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const licenseId = c.req.valid("param").license_id
    if (!licenseId) throw new UsageError("引数 <id> が必要です")
    const client = await createClient()
    const response = await client["software-license"]["software-licenses"][":id"].$get({
      param: { id: licenseId },
    })
    return c.json(await response.json())
  },
)
