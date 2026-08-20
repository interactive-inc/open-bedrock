import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { uploadAttachment } from "@/lib/http/upload-attachment"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock expenses submit --category <c> --amount <n> --spent-at <d> [--note <m>] [--file <path>]...`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      category: z.enum(["transport", "supplies", "entertainment", "books", "other"]).optional(),
      amount: z.string().optional(),
      "spent-at": z.string().optional(),
      note: z.string().optional(),
      file: z.union([z.string(), z.array(z.string())]).optional(),
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

    const paths = query.file === undefined ? [] : [query.file].flat()

    const attachmentIds: string[] = []

    for (const path of paths) {
      attachmentIds.push(await uploadAttachment(path))
    }

    const client = await createClient()

    const response = await client.expenses.$post({
      json: {
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
