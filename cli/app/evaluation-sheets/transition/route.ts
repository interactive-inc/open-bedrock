import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock evaluation-sheets transition --id <sheet-id> --status <s> --expected-revision <n> [--note <text>]

statuses:
  pending_approval, approved, rejected, draft, self_eval,
  primary_eval, secondary_eval, finalized, reopened, archived`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      status: z.string().optional(),
      "expected-revision": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    if (!query.status) throw new UsageError("--status が必要です")

    if (!query["expected-revision"]) throw new UsageError("--expected-revision が必要です")

    const expectedRevision = toFiniteNumber(query["expected-revision"])

    if (expectedRevision === null) {
      throw new UsageError("--expected-revision は数値で指定してください")
    }

    const client = await createClient()

    const response = await client["evaluation-sheets"][":sheet_id"].transition.$post({
      param: { sheet_id: query.id },
      json: {
        status: query.status,
        expected_revision: expectedRevision,
        note: query.note ?? null,
      },
    })

    const sheet = await response.json()

    return c.json(sheet)
  },
)
