import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte bootstrap — 初期 ROOT アカウントを 1 度だけ作成する

usage:
  karte bootstrap --email <email> --password <password> --name <name> [--code <code>] [--token <token>] [--base-url <url>]

--token 省略時は環境変数 BOOTSTRAP_TOKEN を使う。--code 省略時は E001。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      email: z.string().optional(),
      password: z.string().optional(),
      name: z.string().optional(),
      code: z.string().optional(),
      token: z.string().optional(),
      "base-url": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.email || !query.password || !query.name) {
      throw new UsageError("--email と --password と --name が必要です")
    }

    const token = query.token ?? process.env.BOOTSTRAP_TOKEN

    if (!token) {
      throw new UsageError("--token または環境変数 BOOTSTRAP_TOKEN が必要です")
    }

    const client = await createClient(query["base-url"])

    // createClient の fetch ラッパーが 4xx/5xx を ApiError として throw するため、
    // ここに来た時点で response は必ず成功。
    const response = await client.bootstrap.$post({
      json: {
        token,
        email: query.email,
        password: query.password,
        name: query.name,
        code: query.code,
      },
    })

    const result = z
      .object({
        account_id: z.number(),
        employee_id: z.number(),
        email: z.string(),
      })
      .parse(await response.json())

    return c.text(
      `初期 ROOT を作成しました account_id=${result.account_id} employee_id=${result.employee_id} email=${result.email}`,
    )
  },
)
