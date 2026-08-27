import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock ringi-requests admin [--status <s>] [--applicant-id <id>] [--sort <s>] [--limit <n>] [--offset <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      "applicant-id": z.string().optional(),
      sort: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["ringi"]["ringi-requests"].admin.$get({
      query: {
        status: query.status,
        applicant_id: query["applicant-id"],
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      },
    })

    const ringiApplications = await response.json()

    return c.json(ringiApplications)
  },
)
