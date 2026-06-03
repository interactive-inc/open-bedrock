import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte career posting-create --title <t> [--dept-id <n>] [--dept-name <d>] [--skills <s>] [--status open|closed]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      "dept-id": z.string().optional(),
      "dept-name": z.string().optional(),
      skills: z.string().optional(),
      status: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.title) throw new UsageError("--title が必要です")

    const client = await createClient()

    const response = await client.career.postings.$post({
      json: {
        title: query.title,
        dept_id: query["dept-id"] !== undefined ? Number(query["dept-id"]) : undefined,
        dept_name: query["dept-name"] ?? undefined,
        required_skills: query.skills ?? undefined,
        status: query.status === "closed" ? "closed" : "open",
      },
    })

    const posting = await response.json()

    return c.json(posting)
  },
)
