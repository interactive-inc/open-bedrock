import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock training course-update --code <c> --title <t> --category <cat> [--description <d>] [--duration <min>] [--required]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      title: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      duration: z.string().optional(),
      required: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.title || !query.category) {
      throw new UsageError("--code と --title と --category が必要です")
    }

    const client = await createClient()

    const response = await client.training.courses[":code"].$put({
      param: { code: query.code },
      json: {
        title: query.title,
        category: query.category,
        description: query.description ?? null,
        duration_minutes:
          query.duration !== undefined ? toFiniteNumber(query.duration, "--duration") : null,
        is_required: query.required !== undefined,
      },
    })

    const course = await response.json()

    return c.json(course)
  },
)
