import { Application } from "@/domain/application/application"
import { ApplicationApproval } from "@/domain/application/application-approval"
import type { Context } from "@/env"
import { applicationApprovals, applications } from "@/schema"
import { eq } from "drizzle-orm"

export class ApplicationRepository {
  constructor(private readonly c: Context) {}

  async findById(applicationId: number): Promise<Application | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Application.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load application")
    }
  }

  async create(application: Application): Promise<Application | Error> {
    try {
      const rows = await this.c.var.database
        .insert(applications)
        .values({
          templateId: application.templateId,
          applicantId: application.applicantId,
          status: application.status,
          currentStep: application.currentStep,
          payload: JSON.stringify(application.payload),
          createdAt: application.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert application")
        : Application.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert application")
    }
  }

  async update(application: Application): Promise<Application | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(applications)
        .set({ status: application.status, currentStep: application.currentStep })
        .where(eq(applications.id, application.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Application.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update application")
    }
  }

  // 承認/却下の記録は申請集約に属するため、申請リポジトリが永続化する。
  async addApproval(approval: ApplicationApproval): Promise<ApplicationApproval | Error> {
    try {
      const rows = await this.c.var.database
        .insert(applicationApprovals)
        .values({
          applicationId: approval.applicationId,
          approverId: approval.approverId,
          action: approval.action,
          comment: approval.comment,
          createdAt: approval.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert application approval")
        : ApplicationApproval.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert application approval")
    }
  }
}
