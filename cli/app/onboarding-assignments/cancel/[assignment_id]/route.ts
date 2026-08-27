import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock onboarding-assignments cancel <assignment_id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ assignment_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const assignmentId = c.req.valid("param").assignment_id

    if (!assignmentId) throw new UsageError("引数 <assignment_id> が必要です")

    const client = await createClient()

    const response = await client["onboarding"]["onboarding-assignments"][":id"].$delete({
      param: { id: assignmentId },
    })

    if (response.status !== 204) {
      throw new UsageError("割り当ての取り消しに失敗しました")
    }

    return c.json({ id: assignmentId, status: "cancelled" })
  },
)
