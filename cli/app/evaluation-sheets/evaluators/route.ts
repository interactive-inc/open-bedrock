import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock evaluation-sheets evaluators --id <sheet-id> --primary-evaluator-id <id> --expected-revision <n> [--secondary-evaluator-id <id>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      "primary-evaluator-id": z.string().optional(),
      "secondary-evaluator-id": z.string().optional(),
      "expected-revision": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    if (!query["primary-evaluator-id"]) {
      throw new UsageError("--primary-evaluator-id が必要です")
    }

    if (!query["expected-revision"]) throw new UsageError("--expected-revision が必要です")

    const expectedRevision = toFiniteNumber(query["expected-revision"], "--expected-revision")

    const client = await createClient()

    const response = await client["performance-review"]["evaluation-sheets"][
      ":sheetId"
    ].evaluators.$put({
      param: { sheetId: query.id },
      json: {
        primary_evaluator_id: query["primary-evaluator-id"],
        secondary_evaluator_id: query["secondary-evaluator-id"],
        expected_revision: expectedRevision,
      },
    })

    const sheet = await response.json()

    return c.json(sheet)
  },
)
