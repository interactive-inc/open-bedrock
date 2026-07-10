import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { loadConfig, saveConfig } from "@/lib/config/config"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

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

    // createClient の fetch ラッパーが 4xx/5xx を ApiError として throw するため、
    // ここに来た時点で response は必ず成功。手動の ok チェックは不要。
    const response = await client.auth.login.$post({
      json: { email: query.email, password: query.password },
    })

    const result = await response.json()

    if ("error" in result) {
      throw new UsageError(result.error)
    }

    config.token = result.access_token

    config.refresh_token = result.refresh_token ?? null

    await saveConfig(config)

    return c.text(`ログイン成功 base_url=${config.base_url}`)
  },
)
