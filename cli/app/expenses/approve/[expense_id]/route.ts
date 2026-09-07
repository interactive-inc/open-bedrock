import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { parseExpenseDecisionTarget } from "@/lib/expense/parse-expense-decision-target"

export const help = `bedrock expenses approve <id> --decision-target '<json>' [--comment <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "decision-target": z.string().optional(),
      comment: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ expense_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const id = c.req.valid("param").expense_id
    if (!id) throw new UsageError("引数 <id> が必要です")
    const target = parseExpenseDecisionTarget(query["decision-target"])
    const client = await createClient()
    const response = await client.expense["expenses"][":id"].approve.$post({
      param: { id },
      json: { decision_target: target, comment: query.comment ?? null },
    })
    return c.json(await response.json())
  },
)
