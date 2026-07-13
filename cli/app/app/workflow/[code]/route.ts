import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte app workflow <template_code> [--definition '<json>']`

type WorkflowEndpoint = {
  $get(input: { param: { code: string } }): Promise<Response>
  $put(input: { param: { code: string }; json: unknown }): Promise<Response>
}

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      definition: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const code = c.req.param("code") ?? query.code
    if (!code) throw new UsageError("template_code が必要です")
    const client = (await createClient()) as unknown as {
      "application-templates": { ":code": { workflow: WorkflowEndpoint } }
    }
    const endpoint = client["application-templates"][":code"].workflow
    if (query.definition === undefined)
      return c.json(await (await endpoint.$get({ param: { code } })).json())
    let definition: unknown
    try {
      definition = JSON.parse(query.definition)
    } catch {
      throw new UsageError("--definition は正しい JSON が必要です")
    }
    const response = await endpoint.$put({ param: { code }, json: definition })
    return c.json(await response.json())
  },
)
