import { UpdateDocument } from "@/contexts/document/application/update-document"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zAppDocument } from "@/contexts/document/interface/http/response-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** PUT /document-ledger-entries/:id — 文書台帳のメタデータを更新（document:manage）。 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      category: z.string().max(200).nullable().optional(),
      location: z.string().min(1).max(2_000),
      partner_code: z.string().max(200).nullable().optional(),
      expires_on: z.string().max(50).nullable().optional(),
      note: z.string().max(2_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateDocument(c).run({
      session: session,
      documentId: validateIntParam(c.req.param("id"), "document"),
      title: json.title,
      category: json.category ?? null,
      location: json.location,
      partnerCode: json.partner_code ?? null,
      expiresOn: json.expires_on ?? null,
      note: json.note ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppDocument.parse({
      id: updated.id,
      title: updated.title,
      category: updated.category,
      location: updated.location,
      partner_code: updated.partnerCode,
      expires_on: updated.expiresOn,
      note: updated.note,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
