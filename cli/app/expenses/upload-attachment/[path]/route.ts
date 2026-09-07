import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { uploadAttachment } from "@/lib/http/upload-attachment"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
export const help =
  "bedrock expenses upload-attachment <path> — 返ったIDをsubmit --attachment-idへ指定"
export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ path: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)
    const path = c.req.valid("param").path
    if (!path) throw new UsageError("ファイルのpathが必要です")
    return c.json({ attachment_id: await uploadAttachment(path) })
  },
)
