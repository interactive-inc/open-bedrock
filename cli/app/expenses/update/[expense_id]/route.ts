import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock expenses update <id> --category <c> --amount <n> --spent-at <d> [--note <m>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      category: z.enum(["transport", "supplies", "entertainment", "books", "other"]).optional(),
      amount: z.string().optional(),
      "spent-at": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ expense_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const expenseId = c.req.valid("param").expense_id

    if (!expenseId) throw new UsageError("引数 <id> が必要です")

    const category = query.category

    const amount = query.amount

    const spentAt = query["spent-at"]

    if (!category || !amount || !spentAt)
      throw new UsageError("--category と --amount と --spent-at が必要です")

    const client = await createClient()

    // 4xx/5xx は createClient の fetch ラッパーが ApiError として throw するため、
    // ここでの response.ok チェックは不要（到達時は必ず成功）。
    const response = await client["expense"]["expenses"][":id"].$put({
      param: { id: expenseId },
      json: {
        category,
        amount: toFiniteNumber(amount, "--amount"),
        spent_at: spentAt,
        note: query.note ?? null,
      },
    })

    return c.json(await response.json())
  },
)
