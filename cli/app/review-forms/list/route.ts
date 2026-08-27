import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock review-forms list --subject-employee-id <id> [--cycle-id <id>]
  被評価者ごとのフォームと提出状況（360度評価）。本人は開示済みのみ、管理者は全件。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "subject-employee-id": z.string().optional(),
      "cycle-id": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["subject-employee-id"]) throw new UsageError("--subject-employee-id が必要です")

    const client = await createClient()

    const response = await client["performance-review"]["review-forms"].$get({
      query: {
        subject_employee_id: query["subject-employee-id"],
        cycle_id: query["cycle-id"],
      },
    })

    return c.json(await response.json())
  },
)
