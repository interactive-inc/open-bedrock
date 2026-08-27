import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
export const help = `bedrock review-cycles policy --cycle-id <id> [--definition '<json>']`
type PolicyEndpoint = {
  $get(input: { param: { cycle_id: string } }): Promise<Response>
  $put(input: { param: { cycle_id: string }; json: unknown }): Promise<Response>
}
export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      cycle_id: z.string().optional(),
      definition: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    if (!query.cycle_id) throw new UsageError("--cycle-id が必要です")
    const client = (await createClient()) as unknown as {
      "performance-review": { "review-cycles": { ":cycle_id": { policy: PolicyEndpoint } } }
    }
    const endpoint = client["performance-review"]["review-cycles"][":cycle_id"].policy
    if (query.definition === undefined)
      return c.json(await (await endpoint.$get({ param: { cycle_id: query.cycle_id } })).json())
    let definition: unknown
    try {
      definition = JSON.parse(query.definition)
    } catch {
      throw new UsageError("--definition は正しい JSON が必要です")
    }
    const response = await endpoint.$put({ param: { cycle_id: query.cycle_id }, json: definition })
    return c.json(await response.json())
  },
)
