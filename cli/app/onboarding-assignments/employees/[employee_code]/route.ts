import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock onboarding-assignments employees <employee_code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <employee_code> が必要です")

    const client = await createClient()

    const response = await client["onboarding"]["onboarding-assignments"].employees[
      ":employeeCode"
    ].$get({
      param: { employeeCode: employeeCode },
    })

    return c.json(await response.json())
  },
)
