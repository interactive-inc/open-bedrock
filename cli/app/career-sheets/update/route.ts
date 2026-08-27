import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { readJsonFile } from "@/lib/io/read-json"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock career-sheets update --data <file>`

/** --data の JSON は unknown のため、API の PUT body 形に検証してから渡す。 */
const careerSheetUpdateSchema = z.object({
  goals_text: z.string().nullish(),
  strengths_text: z.string().nullish(),
})

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), data: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.data) throw new UsageError("--data <file> が必要です")

    const payload = careerSheetUpdateSchema.parse(await readJsonFile(query.data))

    const client = await createClient()

    const response = await client["career"]["career-sheets"].me.$put({ json: payload })

    const sheet = await response.json()

    return c.json(sheet)
  },
)
