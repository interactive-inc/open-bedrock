import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock meeting-minutes-records add <meeting_code> --held-on <d> --title <t> --body <md> [--attendees <a>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "held-on": z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      attendees: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ meeting_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const code = c.req.valid("param").meeting_code

    if (!code) throw new UsageError("引数 <meeting_code> が必要です")

    const heldOn = query["held-on"]

    if (!heldOn || !query.title || !query.body)
      throw new UsageError("--held-on, --title, --body が必要です")

    const client = await createClient()

    const response = await client["meeting"]["meetings"][":code"].minutes.$post({
      param: { code },
      json: {
        held_on: heldOn,
        title: query.title,
        body_md: query.body,
        attendees: query.attendees ?? null,
      },
    })

    return c.json(await response.json())
  },
)
