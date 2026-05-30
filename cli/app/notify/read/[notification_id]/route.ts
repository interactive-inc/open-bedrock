import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { pretty } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte notify read <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ notification_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const notificationId = c.req.valid("param").notification_id

    if (!notificationId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.notifications[":id"].read.$post({
      param: { id: notificationId },
    })

    const data = await response.json()

    return c.text(pretty(data))
  },
)
