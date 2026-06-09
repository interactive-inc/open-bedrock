import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte payroll correct --id <payslip-id> --period <YYYY-MM> --base <n> --allowances <n> --deductions <n> --net <n>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      period: z.string().optional(),
      base: z.string().optional(),
      allowances: z.string().optional(),
      deductions: z.string().optional(),
      net: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.period || !query.base || !query.net)
      throw new UsageError("--id, --period, --base, --net が必要です")

    const client = await createClient()

    const response = await client.payslips[":id"].$put({
      param: { id: query.id },
      json: {
        period: query.period,
        base_salary: toFiniteNumber(query.base, "--base"),
        allowances:
          query.allowances !== undefined ? toFiniteNumber(query.allowances, "--allowances") : 0,
        deductions:
          query.deductions !== undefined ? toFiniteNumber(query.deductions, "--deductions") : 0,
        net_pay: toFiniteNumber(query.net, "--net"),
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
