import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock onboarding-tasks complete <task_id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ task_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const taskId = c.req.valid("param").task_id

    if (!taskId) throw new UsageError("引数 <task_id> が必要です")

    const client = await createClient()

    const response = await client["onboarding-tasks"][":id"].complete.$post({
      param: { id: taskId },
    })

    return c.json(await response.json())
  },
)
