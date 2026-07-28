import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock job-openings update <id> --title <t> --status open|closed [--department-code <c>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      status: z.enum(["open", "closed"]).optional(),
      "department-code": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    if (!query.title || !query.status) throw new UsageError("--title と --status が必要です")

    const client = await createClient()

    const response = await client["job-openings"][":job_opening_id"].$put({
      param: { job_opening_id: id },
      json: {
        title: query.title,
        status: query.status,
        department_code: query["department-code"] ?? null,
        note: query.note ?? null,
      },
    })

    return c.json(await response.json())
  },
)
