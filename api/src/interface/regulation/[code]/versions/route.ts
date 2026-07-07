import { AddRegulationVersion } from "@/application/regulation/add-regulation-version"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppRegulationVersion } from "@/lib/app-schemas"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /regulations/:code/versions — 既存規程へ新版を追加（regulation:manage）。
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
