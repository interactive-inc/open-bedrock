import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"

/** 公開定義と同じ会社版を、等級・役職のCLI利用者へ返す。 */
export function createCompanyDefinitionListHandlers(props: {
  type: "grade" | "position"
  help: string
}) {
  return factory.createHandlers(
    zValidator(
      "json",
      z
        .object({
          help: z.string().optional(),
          "organization-id": z
            .string()
            .regex(/^\S{1,255}$/)
            .optional(),
          "as-of": z.string().date().optional(),
        })
        .strict(),
    ),
    async (context) => {
      const input = context.req.valid("json")
      if (input.help) return context.text(props.help)
      if (input["organization-id"] === undefined)
        throw new UsageError("--organization-id が必要です")
      const client = await createClient()
      const response = await client.company.definitions.$get({
        header: { "x-company-organization-id": input["organization-id"] },
        query: input["as-of"] === undefined ? {} : { effective_on: input["as-of"] },
      })
      const snapshot = await response.json()
      return context.json({
        ...snapshot,
        resources: snapshot.resources.filter((resource) => resource.type === props.type),
      })
    },
  )
}
