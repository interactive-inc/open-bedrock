import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock software-licenses update <id> --name <n> --expected-revision <revision> [--plan-name <plan> | --clear-plan] [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().trim().min(1).max(300).optional(),
      "plan-name": z.string().trim().min(1).max(300).optional(),
      "clear-plan": z.literal("true").optional(),
      "expected-revision": z
        .string()
        .regex(/^\d+$/)
        .refine((value) => Number.isSafeInteger(Number(value)))
        .optional(),
      vendor: z.string().optional(),
      category: z.enum(["saas", "software", "other"]).optional(),
      seats: z
        .string()
        .regex(/^\d+$/)
        .refine((value) => Number.isSafeInteger(Number(value)))
        .optional(),
      "renewal-deadline": z.string().optional(),
      "owner-employee-id": z.string().optional(),
      note: z.string().optional(),
    }),
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

    if (!query.name) throw new UsageError("--name が必要です")
    if (query["expected-revision"] === undefined)
      throw new UsageError("getで確認した --expected-revision が必要です")
    if (query["clear-plan"] && query["plan-name"] !== undefined)
      throw new UsageError("--plan-name と --clear-plan は同時に指定できません")

    const seats = query.seats === undefined ? undefined : Number(query.seats)

    const ownerEmployeeId =
      query["owner-employee-id"] === undefined ? undefined : query["owner-employee-id"]

    const client = await createClient()

    const response = await client["software-license"]["software-licenses"][":id"].$put({
      param: { id: licenseId },
      header: { "if-match": query["expected-revision"] },
      json: {
        name: query.name,
        plan_name: query["clear-plan"] ? null : query["plan-name"],
        vendor: query.vendor,
        category: query.category,
        seats: seats,
        renewal_deadline: query["renewal-deadline"],
        owner_employee_id: ownerEmployeeId,
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
