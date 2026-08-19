import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock skill-definitions show <code> — 自分の登録スキルを1件表示`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ skill_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const skillCode = c.req.valid("param").skill_code

    if (!skillCode) throw new UsageError("引数 <code> が必要です")

    const client = await createClient()

    const response = await client["employee-skills"].me[":skillCode"].$get({
      param: { skillCode: skillCode },
    })

    return c.json(await response.json())
  },
)
