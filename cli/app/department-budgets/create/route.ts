import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock department-budgets create --department-id <n> --fiscal-period <p> --period-start <d> --period-end <d> --amount <n> --name <s> [--note <m>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "department-id": z.string().optional(),
      "fiscal-period": z.string().optional(),
      "period-start": z.string().optional(),
      "period-end": z.string().optional(),
      amount: z.string().optional(),
      name: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const departmentId = query["department-id"]

    const fiscalPeriod = query["fiscal-period"]

    const periodStart = query["period-start"]

    const periodEnd = query["period-end"]

    const amount = query.amount

    const name = query.name

    if (!departmentId || !fiscalPeriod || !periodStart || !periodEnd || !amount || !name)
      throw new UsageError(
        "--department-id と --fiscal-period と --period-start と --period-end と --amount と --name が必要です",
      )

    const client = await createClient()

    const response = await client["expense"]["department-budgets"].$post({
      json: {
        organization_unit_id: departmentId,
        fiscal_period: fiscalPeriod,
        period_start: periodStart,
        period_end: periodEnd,
        amount: toFiniteNumber(amount, "--amount"),
        name,
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
