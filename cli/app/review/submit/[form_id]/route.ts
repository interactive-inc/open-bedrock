import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte review submit <form_id> --score <n> [--comment <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      score: z.string().optional(),
      comment: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ form_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const formId = c.req.valid("param").form_id

    if (!formId) throw new UsageError("引数 <form_id> が必要です")

    const client = await createClient()

    const response = await client["review-forms"][":form_id"].submit.$post({
      param: { form_id: formId },
      json: {
        score: query.score !== undefined ? Number(query.score) : undefined,
        comment: query.comment,
      },
    })

    return c.json(await response.json())
  },
)
