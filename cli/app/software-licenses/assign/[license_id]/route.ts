import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock software-licenses assign <id> --assignment-id <uuid> --employee-id <id> --reason <text> [--account-reference <reference>]
同じ割当の再送には同じassignment-id・従業員・理由・アカウント参照を指定します。`

export default factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        help: z.string().optional(),
        "assignment-id": z.string().uuid().optional(),
        "employee-id": z
          .string()
          .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
          .optional(),
        "account-reference": z.string().trim().min(1).max(300).optional(),
        reason: z.string().trim().min(1).max(1000).optional(),
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
    if (!query["assignment-id"] || !query["employee-id"] || !query.reason)
      throw new UsageError("--assignment-id、--employee-id、--reason が必要です")
    const client = await createClient()
    const response = await client["software-license"]["software-licenses"][":id"].assignments.$post(
      {
        param: { id: licenseId },
        json: {
          id: query["assignment-id"],
          employee_id: query["employee-id"],
          account_reference: query["account-reference"] ?? null,
          reason: query.reason,
        },
      },
    )
    return c.json(await response.json())
  },
)
