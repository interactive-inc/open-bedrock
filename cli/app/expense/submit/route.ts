import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte expense submit --category <c> --amount <n> --spent-at <d> [--note <m>]`

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
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const category = query.category

    const amount = query.amount

    const spentAt = query["spent-at"]

    if (!category || !amount || !spentAt)
      throw new UsageError("--category と --amount と --spent-at が必要です")

    const client = await createClient()

    const response = await client.expenses.$post({
      json: {
        category,
        amount: toFiniteNumber(amount, "--amount"),
        spent_at: spentAt,
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
