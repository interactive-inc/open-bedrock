import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock expenses submit --request-key <uuid> --category <c> --amount <n> --spent-at <d> [--note <m>] [--attachment-id <id>]... [--existing-expense-id <id> | --previous-expense-id <id>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "request-key": z.string().uuid().optional(),
      "existing-expense-id": z.string().optional(),
      "previous-expense-id": z.string().optional(),
      "attachment-id": z.union([z.string(), z.array(z.string())]).optional(),
      category: z.enum(["transport", "supplies", "entertainment", "books", "other"]).optional(),
      amount: z.string().optional(),
      "spent-at": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const category = query.category

    const amount = query.amount

    const spentAt = query["spent-at"]

    if (!query["request-key"] || !category || !amount || !spentAt)
      throw new UsageError("--request-key と --category と --amount と --spent-at が必要です")

    const attachmentIds =
      query["attachment-id"] === undefined ? [] : [query["attachment-id"]].flat()
    if (attachmentIds.length > 10 || new Set(attachmentIds).size !== attachmentIds.length)
      throw new UsageError("添付は重複なしで10件までです")
    const client = await createClient()

    const response = await client["expense"]["expenses"].$post({
      json: {
        request_key: query["request-key"],
        existing_expense_id:
          query["existing-expense-id"] === undefined
            ? null
            : toFiniteNumber(query["existing-expense-id"], "--existing-expense-id"),
        previous_expense_id:
          query["previous-expense-id"] === undefined
            ? null
            : toFiniteNumber(query["previous-expense-id"], "--previous-expense-id"),
        category,
        amount: toFiniteNumber(amount, "--amount"),
        spent_at: spentAt,
        note: query.note,
        attachment_ids: attachmentIds.length === 0 ? undefined : attachmentIds,
      },
    })

    return c.json(await response.json())
  },
)
