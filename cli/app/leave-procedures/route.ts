import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { api } from "@/lib/http/client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock leave-procedures [--definition '<workflow-json>' --expected-revision <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      definition: z.string().optional(),
      "expected-revision": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    if (query.definition === undefined)
      return c.text(JSON.stringify(await api("/leave/leave-procedures"), null, 2))
    const revisionText = query["expected-revision"]
    if (
      revisionText === undefined ||
      !/^(0|[1-9]\d*)$/.test(revisionText) ||
      !Number.isSafeInteger(Number(revisionText))
    )
      throw new UsageError("--expected-revision に確認した版を指定してください")
    let workflow: unknown
    try {
      workflow = JSON.parse(query.definition)
    } catch {
      throw new UsageError("--definition はJSONで指定してください")
    }
    if (workflow === null || typeof workflow !== "object" || Array.isArray(workflow))
      throw new UsageError("--definition はworkflowオブジェクトが必要です")
    const saved = await api("/leave/leave-procedures", {
      method: "PUT",
      json: { expected_revision: Number(revisionText), workflow },
    })
    return c.text(JSON.stringify(saved, null, 2))
  },
)
