import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock software-licenses assignments [--license-id <id>] [--employee-id <id>] [--state assigned|released] [--limit 1..100] [--offset 0..100000]`

export default factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        help: z.string().optional(),
        "license-id": z
          .string()
          .regex(/^[1-9]\d*$/)
          .refine((value) => Number.isSafeInteger(Number(value)))
          .optional(),
        "employee-id": z
          .string()
          .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
          .optional(),
        state: z.enum(["assigned", "released"]).optional(),
        limit: z
          .string()
          .regex(/^\d+$/)
          .refine((value) => Number(value) >= 1 && Number(value) <= 100)
          .optional(),
        offset: z
          .string()
          .regex(/^\d+$/)
          .refine((value) => Number(value) <= 100000)
          .optional(),
      })
      .strict(),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const client = await createClient()
    const response = await client["software-license"]["software-licenses"].assignments.$get({
      query: {
        license_id: query["license-id"],
        employee_id: query["employee-id"],
        state: query.state,
        limit: query.limit,
        offset: query.offset,
      },
    })
    return c.json(await response.json())
  },
)
