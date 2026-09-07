import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock ringi-requests submit --request-key <uuid> --approver-id <id> --title <t> --amount <n> --reason <r>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "request-key": z.string().uuid().optional(),
      "existing-ringi-id": z.string().optional(),
      "previous-ringi-id": z.string().optional(),
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

    if (!query["request-key"] || !approverId || !title || !amount || !reason)
      throw new UsageError(
        "--request-key と --approver-id と --title と --amount と --reason が必要です",
      )

    const client = await createClient()

    const response = await client["ringi"]["ringi-requests"].$post({
      json: {
        request_key: query["request-key"],
        existing_ringi_id:
          query["existing-ringi-id"] === undefined
            ? null
            : toFiniteNumber(query["existing-ringi-id"], "--existing-ringi-id"),
        previous_ringi_id:
          query["previous-ringi-id"] === undefined
            ? null
            : toFiniteNumber(query["previous-ringi-id"], "--previous-ringi-id"),
        approver_id: approverId,
        title,
        amount: toFiniteNumber(amount, "--amount"),
        reason,
      },
    })

    return c.json(await response.json())
  },
)
