import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock employee-events record --employee-id <id> --kind join|transfer|leave_of_absence|return|retire --effective-date <YYYY-MM-DD> [--from <code>] [--to <code>] [--note <n>]`

const kindSchema = z.enum(["join", "transfer", "leave_of_absence", "return", "retire"])

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      kind: z.string().optional(),
      "effective-date": z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-id"] || !query.kind || !query["effective-date"])
      throw new UsageError("--employee-id, --kind, --effective-date が必要です")

    const kind = kindSchema.safeParse(query.kind)

    if (kind.success === false)
      throw new UsageError(
        "--kind は join / transfer / leave_of_absence / return / retire のいずれかです",
      )

    const client = await createClient()

    const response = await client.company["employee-events"].$post({
      json: {
        employee_id: query["employee-id"],
        kind: kind.data,
        effective_date: query["effective-date"],
        from_department_code: query.from,
        to_department_code: query.to,
        note: query.note,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
