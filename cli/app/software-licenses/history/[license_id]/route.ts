import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock software-licenses history <id> [--offset 0..100000]`

export default factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        help: z.string().optional(),
        offset: z
          .string()
          .regex(/^\d+$/)
          .refine((value) => Number(value) <= 100000)
          .optional(),
      })
      .strict(),
  ),
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
    const response = await client["software-license"]["software-licenses"][":id"].history.$get({
      param: { id: licenseId },
      query: { offset: query.offset },
    })
    return c.json(await response.json())
  },
)
