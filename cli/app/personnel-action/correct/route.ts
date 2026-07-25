import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `bedrock personnel-action correct --action-id <id> --payload <json-file> --reason <text> --idempotency-key <key>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "action-id": z.string().uuid().optional(),
      payload: z.string().optional(),
      reason: z.string().min(1).max(2000).optional(),
      "idempotency-key": z.string().min(1).max(200).optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (!input["action-id"] || !input.payload || !input.reason || !input["idempotency-key"]) {
      throw new UsageError("--action-id, --payload, --reason, --idempotency-key が必要です")
    }
    const file = await readJsonObjectFile(input.payload)
    const client = await createClient()
    const endpoint = client["personnel-actions"][":id"].correct.$post
    type RequestJson = Parameters<typeof endpoint>[0]["json"]
    const response = await endpoint(
      {
        param: { id: input["action-id"] },
        json: { ...file, reason: input.reason } as RequestJson,
      },
      { headers: { "Idempotency-Key": input["idempotency-key"] } },
    )
    return c.json(await response.json())
  },
)
