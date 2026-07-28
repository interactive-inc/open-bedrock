import { UpdateContract } from "@/application/contract/update-contract"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppContract } from "@/lib/app-schemas"
import { isoDate } from "@/lib/schemas"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** PUT /partner-contracts/:id — 契約記録の表題・契約日・期間・更新期限・備考を更新（contract:manage） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      contract_date: isoDate,
      starts_on: isoDate.optional(),
      ends_on: isoDate.optional(),
      renewal_deadline: isoDate.optional(),
      note: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateContract(c).run({
      session: session,
      id: validateIntParam(c.req.param("id"), "contract"),
      details: {
        title: json.title,
        contractDate: json.contract_date,
        startsOn: json.starts_on ?? null,
        endsOn: json.ends_on ?? null,
        renewalDeadline: json.renewal_deadline ?? null,
        note: json.note ?? null,
      },
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppContract.parse({
      id: updated.id,
      partner_id: updated.partnerId,
      title: updated.title,
      contract_date: updated.contractDate,
      starts_on: updated.startsOn,
      ends_on: updated.endsOn,
      renewal_deadline: updated.renewalDeadline,
      note: updated.note,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
