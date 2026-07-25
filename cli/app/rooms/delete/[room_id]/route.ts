import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock rooms delete <room_id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ room_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const roomId = c.req.valid("param").room_id

    if (!roomId) throw new UsageError("引数 <room_id> が必要です")

    const client = await createClient()

    const response = await client.rooms[":id"].$delete({ param: { id: roomId } })

    if (response.status !== 204) {
      throw new UsageError("会議室の削除に失敗しました")
    }

    return c.json({ id: roomId, status: "deleted" })
  },
)
