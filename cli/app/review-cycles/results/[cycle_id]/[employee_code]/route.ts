import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock review-cycles results <cycle_id> <employee_code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator(
    "param",
    z.object({
      cycle_id: z.string().optional(),
      employee_code: z.string().optional(),
    }),
  ),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const param = c.req.valid("param")

    const cycleId = param.cycle_id

    const employeeCode = param.employee_code

    if (!cycleId) throw new UsageError("引数 <cycle_id> が必要です")

    if (!employeeCode) throw new UsageError("引数 <employee_code> が必要です")

    const client = await createClient()

    const response = await client["review-cycles"][":cycleId"].results[":employeeCode"].$get({
      param: { cycleId: cycleId, employeeCode: employeeCode },
    })

    return c.json(await response.json())
  },
)
