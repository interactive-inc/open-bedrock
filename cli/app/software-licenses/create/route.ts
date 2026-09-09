import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock software-licenses create --name <n> --idempotency-key <key> [--plan-name <plan>] [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().trim().min(1).max(300).optional(),
      "plan-name": z.string().trim().min(1).max(300).optional(),
      "idempotency-key": z
        .string()
        .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]{0,99}$/)
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
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.name) throw new UsageError("--name が必要です")
    if (!query["idempotency-key"])
      throw new UsageError(
        "--idempotency-key が必要です。同じ登録の再送には同じキーを使ってください",
      )

    const seats = query.seats === undefined ? undefined : Number(query.seats)

    const ownerEmployeeId =
      query["owner-employee-id"] === undefined ? undefined : query["owner-employee-id"]

    const client = await createClient()

    const response = await client["software-license"]["software-licenses"].$post({
      header: { "idempotency-key": query["idempotency-key"] },
      json: {
        name: query.name,
        plan_name: query["plan-name"],
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
