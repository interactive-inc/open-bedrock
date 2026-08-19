import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

const evaluationSheetStatusSchema = z.enum([
  "approved",
  "rejected",
  "archived",
  "draft",
  "pending_approval",
  "self_eval",
  "primary_eval",
  "secondary_eval",
  "finalized",
  "reopened",
])

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
      status: evaluationSheetStatusSchema.optional(),
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

    const expectedRevision = toFiniteNumber(query["expected-revision"], "--expected-revision")

    const client = await createClient()

    const response = await client["evaluation-sheets"][":sheetId"].transition.$post({
      param: { sheetId: query.id },
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
