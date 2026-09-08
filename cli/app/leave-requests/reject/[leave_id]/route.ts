import { parseLeaveDecisionTarget } from "@/lib/leave/parse-leave-decision-target"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock leave-requests reject <id> --decision-target '<json>' --comment <c>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      comment: z.string().optional(),
      "decision-target": z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ leave_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const leaveId = c.req.valid("param").leave_id

    if (!leaveId) throw new UsageError("引数 <id> --decision-target '<json>' が必要です")

    if (!query.comment) throw new UsageError("--comment が必要です")

    const target = parseLeaveDecisionTarget(query["decision-target"])
    if (target.request_id !== Number(leaveId))
      throw new UsageError("判断対象の申請IDが一致しません")

    const client = await createClient()

    const response = await client["leave"]["leave-requests"][":id"].reject.$post({
      param: { id: leaveId },
      json: { comment: query.comment, decision_target: target },
    })

    const result = await response.json()

    return c.text(`rejected id=${leaveId} status=${result.status}`)
  },
)
