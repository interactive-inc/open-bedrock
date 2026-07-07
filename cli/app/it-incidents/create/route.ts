import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte it-incidents create --occurred-at <t> --title <t> --summary <t> [--severity low|medium|high|critical]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "occurred-at": z.string().optional(),
      title: z.string().optional(),
      summary: z.string().optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["occurred-at"] || !query.title || !query.summary)
      throw new UsageError("--occurred-at と --title と --summary が必要です")

    const client = await createClient()

    const response = await client["it-incidents"].$post({
      json: {
        occurred_at: query["occurred-at"],
        title: query.title,
        summary: query.summary,
        severity: query.severity,
      },
    })

    return c.json(await response.json())
  },
)
