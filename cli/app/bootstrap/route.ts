import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { ApiError, UsageError } from "@/lib/errors"

export const help = `bedrock bootstrap — 初期 ROOT アカウントを 1 度だけ作成する

usage:
  bedrock bootstrap --email <email> --password <password> --name <name> [--code <code>] [--token <token>] [--base-url <url>]

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

    const baseUrl = resolveBaseUrl(query["base-url"])
    const client = await createClient(baseUrl)

    try {
      await client.system.bootstrap.$post({
        json: { token, email: query.email, password: query.password },
      })
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error
    }

    const sessionResponse = await client.system.sessions.$post({
      json: { subject: query.email, password: query.password },
    })
    const session = z
      .object({
        account_id: z.string(),
        access_token: z.string(),
        refresh_token: z.string().nullable(),
      })
      .parse(await sessionResponse.json())

    let employeeId: number | null = null
    try {
      const companyResponse = await client.company.bootstrap.$post(
        { json: { name: query.name, code: query.code } },
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      )
      const company = z
        .object({ account_id: z.string(), employee_id: z.number() })
        .parse(await companyResponse.json())
      employeeId = company.employee_id
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error
    }

    await new SettingsFile().saveLogin(
      baseUrl,
      { token: session.access_token, refresh_token: session.refresh_token },
      query.email,
      query.name,
    )

    return c.text(
      employeeId === null
        ? `初期化済みです account_id=${session.account_id} email=${query.email}`
        : `初期 ROOT を作成しました account_id=${session.account_id} employee_id=${employeeId} email=${query.email}`,
    )
  },
)
