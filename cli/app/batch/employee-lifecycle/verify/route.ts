import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `bedrock batch employee-lifecycle verify --baseline-on <date> --time-zone <iana-zone> --fingerprint <sha256>`
export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "baseline-on": z.string().optional(),
      "time-zone": z.string().optional(),
      fingerprint: z.string().optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (!input["baseline-on"] || !input["time-zone"] || !input.fingerprint)
      throw new UsageError("--baseline-on, --time-zone, --fingerprint が必要です")
    const client = await createClient()
    const response = await client.batch["employee-lifecycle"].verify.$post({
      json: {
        baseline_on: input["baseline-on"],
        time_zone: input["time-zone"],
        legacy_source_fingerprint: input.fingerprint,
      },
    })
    return c.json(await response.json())
  },
)
