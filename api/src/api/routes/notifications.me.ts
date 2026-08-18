import { companyNotificationKindSchema } from "@/contexts/company-compatibility/domain/company/notifications/notification-kind"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { zAppNotificationList } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification-repository"
import { zAccountId } from "@system/domain/auth/account-id"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /notifications/me — 本人宛ての通知一覧（新着順） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      is_read: z.enum(["true", "false"]).optional(),
      limit: z
        .string()
        .regex(/^\d{1,3}$/)
        .transform(Number)
        .default(20)
        .pipe(z.number().int().min(1).max(100)),
      offset: z
        .string()
        .regex(/^\d{1,5}$/)
        .transform(Number)
        .default(0)
        .pipe(z.number().int().min(0).max(10_000)),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")
    const page = await new SystemNotificationRepository({
      context: { env: { DB: c.env.DB } },
    }).listForAccount({
      recipientAccountId: zAccountId.parse(String(session.accountId)),
      read: query.is_read === undefined ? null : query.is_read === "true",
      limit: query.limit,
      offset: query.offset,
    })
    if (page instanceof Error) throw page

    const data = page.items.flatMap(({ delivery, message }) => {
      const kind = companyNotificationKindSchema.safeParse(message.kind.replace(/^company:/, ""))
      if (!kind.success) return []

      let source: { domain: string; id: number | null }
      try {
        const parsed = z
          .object({ domain: z.string(), id: z.number().int().positive().safe().nullable() })
          .parse(JSON.parse(message.source?.id ?? ""))
        source = parsed
      } catch {
        return []
      }

      const id = Number(delivery.id)
      if (!Number.isSafeInteger(id) || id < 1 || String(id) !== delivery.id) {
        return []
      }

      return [
        {
          id,
          recipient_employee_id: session.employeeId,
          source_domain: source.domain,
          source_id: source.id,
          kind: kind.data,
          title: message.title,
          body: message.body,
          is_read: delivery.isRead,
          created_at: message.createdAt.toISOString(),
        },
      ]
    })

    if (data.length !== page.items.length) {
      throw new Error("canonical notification is not compatible with the public API")
    }

    const responseBody = zAppNotificationList.parse({ data, total: page.total })

    return c.json(responseBody, 200)
  },
)
