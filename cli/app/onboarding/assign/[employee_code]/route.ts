import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { pretty } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte onboarding assign <employee_code> --template <code>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      template: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <employee_code> が必要です")

    if (!query.template) throw new UsageError("--template が必要です")

    const client = await createClient()

    const response = await client.onboarding.assign.$post({
      json: {
        employee_code: employeeCode,
        template_code: query.template,
      },
    })

    return c.text(pretty(await response.json()))
  },
)
