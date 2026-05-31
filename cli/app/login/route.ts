import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { loadConfig, saveConfig } from "@/lib/config/config"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { ApiError, UsageError } from "@/lib/errors"

export const help = `karte login — ログインしてトークンを取得

usage:
  karte login --email <email> --password <password> [--base-url <url>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      email: z.string().optional(),
      password: z.string().optional(),
      "base-url": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.email || !query.password) {
      throw new UsageError("--email と --password が必要です")
    }

    const config = await loadConfig()

    if (query["base-url"]) config.base_url = query["base-url"]

    const client = await createClient(config.base_url)

    const response = await client.auth.login.$post({
      json: { email: query.email, password: query.password },
    })

    if (!response.ok) {
      let message: string
      try {
        message = JSON.stringify(await response.json())
      } catch {
        message = await response.text()
      }
      throw new ApiError(response.status, `ログイン失敗 ${response.status} ${message}`)
    }

    const result = await response.json()

    config.token = result.access_token

    await saveConfig(config)

    return c.text(`ログイン成功 base_url=${config.base_url}`)
  },
)
