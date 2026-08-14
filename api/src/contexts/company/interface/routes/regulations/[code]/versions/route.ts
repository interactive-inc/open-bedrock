import { AddRegulationVersion } from "@/contexts/company/application/regulation/add-regulation-version"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppRegulationVersion } from "@/lib/app-schemas"
import { validateCodeParam } from "@/contexts/company/interface/utils/validate-code-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /regulations/:code/versions — 既存規程へ新版を追加（regulation:manage）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      body_md: z.string().min(1).max(50_000),
      effective_on: z.string().min(1).max(50),
      note: z.string().max(2_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const added = await new AddRegulationVersion(c).run({
      session: session,
      code: validateCodeParam(c.req.param("code"), "regulation"),
      bodyMd: json.body_md,
      effectiveOn: json.effective_on,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (added instanceof ApplicationError) {
      throw toHttpException(added)
    }

    const responseBody = zAppRegulationVersion.parse({
      id: added.version.id,
      version: added.version.version,
      body_md: added.version.bodyMd,
      effective_on: added.version.effectiveOn,
      note: added.version.note,
      created_at: added.version.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
