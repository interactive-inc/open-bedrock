import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte payroll revise --employee-code <c> --effective-date <d> --new-base <n> [--reason <r>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-code": z.string().optional(),
      "effective-date": z.string().optional(),
      "new-base": z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-code"] || !query["effective-date"] || !query["new-base"])
      throw new UsageError("--employee-code と --effective-date と --new-base が必要です")

    const client = await createClient()

    const response = await client["salary-revisions"].$post({
      json: {
        employee_code: query["employee-code"],
        effective_date: query["effective-date"],
        new_base_salary: Number(query["new-base"]),
        reason: query.reason,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
