import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { pretty } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte survey summary <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ survey_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const surveyId = c.req.valid("param").survey_id

    if (!surveyId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.surveys[":survey_id"].summary.$get({
      param: { survey_id: surveyId },
    })

    const result = await response.json()

    return c.text(pretty(result))
  },
)
