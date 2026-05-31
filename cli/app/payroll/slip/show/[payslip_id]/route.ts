import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte payroll slip show <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ payslip_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const payslipId = c.req.valid("param").payslip_id

    if (!payslipId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.payslips[":id"].$get({
      param: { id: payslipId },
    })

    const data = await response.json()

    return c.json(data)
  },
)
