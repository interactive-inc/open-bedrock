import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte org dept update --code <c> --order <n> [--parent <c>] [--manager <employee-code>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      order: z.string().optional(),
      parent: z.string().optional(),
      manager: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.order) throw new UsageError("--code, --order が必要です")

    const client = await createClient()

    const response = await client.org.departments[":code"].$put({
      param: { code: query.code },
      json: {
        parent_code: query.parent ?? null,
        manager_employee_code: query.manager ?? null,
        order: toFiniteNumber(query.order, "--order"),
      },
    })

    const department = await response.json()

    return c.json(department)
  },
)
