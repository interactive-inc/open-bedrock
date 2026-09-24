import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock career-postings update --id <id> --title <t> [--organization-unit-id <id>] [--skills <s>] [--status open|closed]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      title: z.string().optional(),
      "organization-unit-id": z.string().optional(),
      skills: z.string().optional(),
      status: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.title) throw new UsageError("--id と --title が必要です")

    const client = await createClient()

    const response = await client["career"]["career-postings"][":postingId"].$put({
      param: { postingId: query.id },
      json: {
        title: query.title,
        organization_unit_id: query["organization-unit-id"] ?? null,
        required_skills: query.skills ?? null,
        status: query.status === "closed" ? "closed" : "open",
      },
    })

    const posting = await response.json()

    return c.json(posting)
  },
)
