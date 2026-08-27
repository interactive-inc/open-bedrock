import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock assets lend <code> --employee-code <e>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-code": z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ asset_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const assetCode = c.req.valid("param").asset_code

    if (!assetCode) throw new UsageError("引数 <code> が必要です")

    if (!query["employee-code"]) throw new UsageError("--employee-code が必要です")

    const client = await createClient()

    await client["asset"]["assets"][":code"].lend.$post({
      param: { code: assetCode },
      json: { employee_code: query["employee-code"] },
    })

    return c.text(`lent code=${assetCode} holder=${query["employee-code"]}`)
  },
)
