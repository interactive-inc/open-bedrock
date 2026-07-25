import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock org dept create --code <c> --department-id <n> --order <n> [--parent <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      "department-id": z.string().optional(),
      order: z.string().optional(),
      parent: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query["department-id"] || !query.order)
      throw new UsageError("--code, --department-id, --order が必要です")

    const client = await createClient()

    const response = await client.org.departments.$post({
      json: {
        code: query.code,
        department_id: toFiniteNumber(query["department-id"], "--department-id"),
        parent_code: query.parent ?? null,
        order: toFiniteNumber(query.order, "--order"),
      },
    })

    const department = await response.json()

    return c.json(department)
  },
)
