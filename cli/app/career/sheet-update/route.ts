import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { readJsonFile } from "@/lib/io/read-json"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte career sheet-update --data <file>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), data: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.data) throw new UsageError("--data <file> が必要です")

    const raw = await readJsonFile(query.data)

    const payload = toSheetPayload(raw)

    const client = await createClient()

    const response = await client.career.sheet.me.$put({ json: payload })

    const sheet = await response.json()

    return c.json(sheet)
  },
)

// 読み込んだ任意 JSON から career sheet の更新ボディ(goals_text/strengths_text)を取り出す。
function toSheetPayload(raw: unknown): {
  goals_text?: string | null
  strengths_text?: string | null
} {
  if (typeof raw !== "object" || raw === null) {
    return {}
  }

  const goals = "goals_text" in raw ? raw.goals_text : null

  const strengths = "strengths_text" in raw ? raw.strengths_text : null

  return {
    goals_text: typeof goals === "string" ? goals : null,
    strengths_text: typeof strengths === "string" ? strengths : null,
  }
}
