import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock shift swap --target-employee-code <c> --date <date> [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "target-employee-code": z.string().optional(),
      date: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["target-employee-code"] || !query.date) {
      throw new UsageError("--target-employee-code と --date が必要です")
    }

    const client = await createClient()

    const response = await client.shift["swap-requests"].$post({
      json: {
        target_employee_code: query["target-employee-code"],
        date: query.date,
        note: query.note,
      },
    })

    const swapRequest = await response.json()

    return c.json(swapRequest)
  },
)
