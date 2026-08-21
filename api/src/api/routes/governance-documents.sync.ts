import { SyncGovernanceMarkdown } from "@/contexts/governance/application/sync-governance-markdown"
import { prepareGovernanceAudit } from "@/api/http/audit/prepare-governance-audit"
import { PERMISSION_KEYS } from "@/api/http/permissions/permission-key.catalog"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { verifyBearer } from "@/api/http/verify-bearer"
import { readTrainingCourseCodeSet } from "@/contexts/training/interface/http/training-courses/read-training-course-code-set"
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
  const result = await new SyncGovernanceMarkdown(c, PERMISSION_KEYS, (audit) =>
    prepareGovernanceAudit({ c, ...audit }),
  ).run({
    session,
    referenceCatalog: { training: await readTrainingCourseCodeSet(c) },
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
