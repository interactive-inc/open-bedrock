import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock career-postings show <id> — 社内公募の詳細（管理ロール）`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ posting_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const postingId = c.req.valid("param").posting_id

    if (!postingId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["career-postings"][":postingId"].$get({
      param: { postingId: postingId },
    })

    const posting = await response.json()

    return c.json(posting)
  },
)
