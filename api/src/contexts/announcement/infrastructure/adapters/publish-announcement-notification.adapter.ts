import { readCompanyAccountEmployeeLinks } from "@/contexts/company/interface/operations/read-company-account-employee-links"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type { Announcement } from "@/contexts/announcement/domain/entities/announcement.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { Context } from "@/env"
import { prepareSystemNotificationPublicationBatch } from "@system/interface/operations/prepare-system-notification-publication-batch"

export class PublishAnnouncementNotificationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async publishToAllEmployees(
    announcement: Announcement,
    createdAtValue: string,
  ): Promise<null | Error> {
    try {
      const links = await readCompanyAccountEmployeeLinks(this.c, {})
      if (links instanceof Error) return links
      const employees = await openCompanyEmployeeDirectory({
        env: this.c.env,
      }).findForAccountIds(links.map((link) => zAccountId.parse(link.accountId)))
      if (employees instanceof Error) return employees
      const recipients = employees.filter(
        (entry) =>
          entry.employee.employment?.status === "ACTIVE" ||
          entry.employee.employment?.status === "ON_LEAVE",
      )

      if (recipients.length === 0) return null

      const createdAt = new Date(createdAtValue)
      const statements = prepareSystemNotificationPublicationBatch({
        database: this.c.env.DB,
        publications: [
          {
            message: {
              id: crypto.randomUUID(),
              kind: "company:announcement",
              title: announcement.title,
              body: null,
              source: {
                type: "company:notification.source",
                id: JSON.stringify({ domain: "announcement", id: announcement.id }),
              },
              action: null,
              resourceScope: null,
              priority: "normal",
              publicationKey: null,
              createdAt,
            },
            deliveries: recipients.map((recipient) => ({
              id: crypto.randomUUID(),
              recipientAccountId: String(recipient.accountId),
              deliveredAt: createdAt,
            })),
          },
        ],
      })
      if (statements instanceof Error) return statements

      const results = await this.c.env.DB.batch([...statements])
      if (results.length !== statements.length || !results.every((result) => result.success)) {
        return new Error("announcement notification publication did not succeed")
      }

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to notify announcement")
    }
  }
}
