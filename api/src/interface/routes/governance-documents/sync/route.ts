import { SyncGovernanceMarkdown } from "@/application/governance/sync-governance-markdown"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const request = z.strictObject({
  documents: z
    .array(
      z.strictObject({
        source_path: z.string().min(3).max(500),
        markdown: z.string().min(1).max(300_000),
        expected_content_hash: z.string().length(64).nullable().optional(),
      }),
    )
    .min(1)
    .max(100),
})

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(verifyBearer, zValidator("json", request), async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const body = c.req.valid("json")
  const result = await new SyncGovernanceMarkdown(c).run({
    session,
    documents: body.documents.map((document) => ({
      sourcePath: document.source_path,
      markdown: document.markdown,
      expectedContentHash: document.expected_content_hash,
    })),
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json({ data: result }, 200)
})
