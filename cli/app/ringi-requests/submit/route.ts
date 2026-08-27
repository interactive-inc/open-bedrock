import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock ringi-requests submit --approver-id <id> --title <t> --amount <n> --reason <r>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "approver-id": z.string().optional(),
      title: z.string().optional(),
      amount: z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const approverId = query["approver-id"]

    const title = query.title

    const amount = query.amount

    const reason = query.reason

    if (!approverId || !title || !amount || !reason)
      throw new UsageError("--approver-id と --title と --amount と --reason が必要です")

    const client = await createClient()

    const response = await client["ringi"]["ringi-requests"].$post({
      json: {
        approver_id: approverId,
        title,
        amount: toFiniteNumber(amount, "--amount"),
        reason,
      },
    })

    return c.json(await response.json())
  },
)
