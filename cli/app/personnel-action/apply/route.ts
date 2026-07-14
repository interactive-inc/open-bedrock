import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `karte personnel-action apply --type <type> --payload <json-file> --employee-revision <n> [--organization-revision <n>] --idempotency-key <key>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      type: z.string().optional(),
      payload: z.string().optional(),
      "employee-revision": z.coerce.number().int().nonnegative().optional(),
      "organization-revision": z.coerce.number().int().nonnegative().optional(),
      "idempotency-key": z.string().min(1).max(200).optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (
      !input.type ||
      !input.payload ||
      input["employee-revision"] === undefined ||
      !input["idempotency-key"]
    ) {
      throw new UsageError("--type, --payload, --employee-revision, --idempotency-key が必要です")
    }
    const action = { ...(await readJsonObjectFile(input.payload)), kind: input.type }
    const client = await createClient()
    const endpoint = client["personnel-actions"].$post
    type RequestJson = Parameters<typeof endpoint>[0]["json"]
    const response = await endpoint(
      {
        json: {
          action,
          expected_employee_revision: input["employee-revision"],
          expected_organization_revision: input["organization-revision"] ?? null,
        } as RequestJson,
      },
      { headers: { "Idempotency-Key": input["idempotency-key"] } },
    )
    return c.json(await response.json())
  },
)
