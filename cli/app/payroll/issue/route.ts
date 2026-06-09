import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte payroll issue --employee-code <c> --period <YYYY-MM> --base <n> [--allowances <n>] [--deductions <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-code": z.string().optional(),
      period: z.string().optional(),
      base: z.string().optional(),
      allowances: z.string().optional(),
      deductions: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-code"] || !query.period || !query.base)
      throw new UsageError("--employee-code と --period と --base が必要です")

    const client = await createClient()

    const response = await client.payslips.$post({
      json: {
        employee_code: query["employee-code"],
        period: query.period,
        base_salary: toFiniteNumber(query.base, "--base"),
        allowances:
          query.allowances !== undefined ? toFiniteNumber(query.allowances, "--allowances") : 0,
        deductions:
          query.deductions !== undefined ? toFiniteNumber(query.deductions, "--deductions") : 0,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
