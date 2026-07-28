import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock assets update <code> --name <n> --kind pc|monitor|furniture|other [--serial <s>] [--purchased-on <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      kind: z.string().optional(),
      serial: z.string().optional(),
      "purchased-on": z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ asset_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const assetCode = c.req.valid("param").asset_code

    if (!assetCode) throw new UsageError("引数 <code> が必要です")

    if (!query.name || !query.kind) throw new UsageError("--name と --kind が必要です")

    const kind = toKind(query.kind)

    if (kind === null) throw new UsageError("--kind は pc|monitor|furniture|other のいずれか")

    const client = await createClient()

    const response = await client.assets[":code"].$put({
      param: { code: assetCode },
      json: {
        name: query.name,
        kind: kind,
        serial: query.serial,
        purchased_on: query["purchased-on"],
      },
    })

    return c.json(await response.json())
  },
)

/** --kind の文字列を許容値に絞る。不正値は null。 */
function toKind(value: string): "pc" | "monitor" | "furniture" | "other" | null {
  if (value === "pc" || value === "monitor" || value === "furniture" || value === "other") {
    return value
  }

  return null
}
