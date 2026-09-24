import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { isEntityIdSegment } from "@/lib/is-entity-id-segment"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock software-licenses cancel <id> --expected-revision <revision>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "expected-revision": z
        .string()
        .regex(/^\d+$/)
        .refine((value) => Number.isSafeInteger(Number(value)))
        .optional(),
    }),
  ),
  zValidator(
    "param",
    z.object({
      license_id: z.string().refine(isEntityIdSegment).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const licenseId = c.req.valid("param").license_id

    if (!licenseId) throw new UsageError("引数 <id> が必要です")

    if (query["expected-revision"] === undefined)
      throw new UsageError("getで確認した --expected-revision が必要です")

    const client = await createClient()

    const response = await client["software-license"]["software-licenses"][":id"].cancel.$post({
      param: { id: licenseId },
      header: { "if-match": query["expected-revision"] },
    })

    return c.json(await response.json())
  },
)
