import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock employee-skills set <code> --level <n> [--years <y>] [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      level: z.string().optional(),
      years: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ skill_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const skillCode = c.req.valid("param").skill_code

    if (!skillCode) throw new UsageError("引数 <code> が必要です")

    if (!query.level) throw new UsageError("--level が必要です")

    const json = {
      skill_code: skillCode,
      level: toFiniteNumber(query.level, "--level"),
      years: query.years !== undefined ? toFiniteNumber(query.years, "--years") : undefined,
      note: query.note,
    }

    const client = await createClient()

    const response = await client["employee-skills"].me.$put({ json })

    return c.json(await response.json())
  },
)
