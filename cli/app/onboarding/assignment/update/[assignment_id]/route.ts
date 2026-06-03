import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte onboarding assignment update <assignment_id> --assigned-at <iso>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), "assigned-at": z.string().optional() }),
  ),
  zValidator("param", z.object({ assignment_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const assignmentId = c.req.valid("param").assignment_id

    if (!assignmentId) throw new UsageError("引数 <assignment_id> が必要です")

    if (!query["assigned-at"]) throw new UsageError("--assigned-at が必要です")

    const client = await createClient()

    const response = await client.onboarding.assignments[":id"].$put({
      param: { id: assignmentId },
      json: { assigned_at: query["assigned-at"] },
    })

    return c.json(await response.json())
  },
)
