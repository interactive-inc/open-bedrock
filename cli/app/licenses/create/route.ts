import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock licenses create --name <n> [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      vendor: z.string().optional(),
      category: z.enum(["saas", "software", "other"]).optional(),
      seats: z.string().optional(),
      "renewal-deadline": z.string().optional(),
      "owner-employee-id": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.name) throw new UsageError("--name が必要です")

    const seats = query.seats === undefined ? undefined : toFiniteNumber(query.seats, "--seats")

    const ownerEmployeeId =
      query["owner-employee-id"] === undefined
        ? undefined
        : toFiniteNumber(query["owner-employee-id"], "--owner-employee-id")

    const client = await createClient()

    const response = await client.licenses.$post({
      json: {
        name: query.name,
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
