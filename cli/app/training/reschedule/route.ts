import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte training reschedule --id <enrollment-id> [--due <date>] — 受講期限を変更`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      due: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    const client = await createClient()

    const response = await client.training.enrollments[":id"].$put({
      param: { id: query.id },
      json: { due_date: query.due ?? null },
    })

    const enrollment = await response.json()

    return c.json(enrollment)
  },
)
