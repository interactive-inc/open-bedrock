import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `bedrock personnel-action request --type <type> --payload <json-file> --employee-revision <n> [--organization-revision <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      type: z.string().optional(),
      payload: z.string().optional(),
      "employee-revision": z.coerce.number().int().nonnegative().optional(),
      "organization-revision": z.coerce.number().int().nonnegative().optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (!input.type || !input.payload || input["employee-revision"] === undefined) {
      throw new UsageError("--type, --payload, --employee-revision が必要です")
    }
    const action = { ...(await readJsonObjectFile(input.payload)), kind: input.type }
    const client = await createClient()
    const endpoint = client["personnel-action-requests"].$post
    type RequestJson = Parameters<typeof endpoint>[0]["json"]
    const response = await endpoint({
      json: {
        action,
        base_employee_revision: input["employee-revision"],
        base_organization_revision: input["organization-revision"] ?? null,
      } as RequestJson,
    })
    return c.json(await response.json())
  },
)
