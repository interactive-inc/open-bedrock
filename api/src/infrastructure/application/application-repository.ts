import { Application } from "@/domain/application/application.entity"
import { ApplicationApproval } from "@/domain/application/application-approval.entity"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import { applicationApprovals, applications } from "@/schema"
import { DEFAULT_LIST_LIMIT } from "@/interface/utils/to-bounded-int"
import { and, count, desc, eq } from "drizzle-orm"

export class ApplicationRepository {
  constructor(private readonly c: Context) {}

  /** 申請者本人の申請を作成日時の降順で返す。 */
  async findByApplicantId(
    applicantId: number,
    opts?: { limit: number; offset: number },
  ): Promise<ReadonlyArray<Application> | Error> {
    try {
      const query = this.c.var.database
        .select()
        .from(applications)
        .where(eq(applications.applicantId, applicantId))
        .orderBy(desc(applications.createdAt))

      const rows =
        opts !== undefined
          ? await query.limit(opts.limit).offset(opts.offset)
          : await query.limit(DEFAULT_LIST_LIMIT)

      const applicationList: Array<Application> = []

      for (const row of rows) {
        const application = Application.fromRow(row)

        if (application instanceof Error) {
          return application
        }

        applicationList.push(application)
      }

      return applicationList
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load applications")
    }
  }

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

  /**
   * 承認/却下を pending からの条件付き UPDATE で確定する。決定済みは 0 行更新となり null を返す。
   * 二重決定を防ぐ冪等性ガード（TOCTOU 競合にも強い）。確定時は current_step も外す。
   */
  async decideFromPending(props: {
    applicationId: number
    status: "approved" | "rejected"
  }): Promise<Application | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(applications)
        .set({ status: props.status, currentStep: null })
        .where(and(eq(applications.id, props.applicationId), eq(applications.status, "pending")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Application.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to decide application")
    }
  }

  /**
   * 申請内容（payload）を更新する。status や currentStep は変更しない。
   * pending 以外の申請は更新できない（0 行更新で null を返す）。
   */
  async updatePayload(application: Application): Promise<Application | null | Error> {
    try {
      if (application.id === null) {
        return new Error("cannot update unsaved application")
      }

      const rows = await this.c.var.database
        .update(applications)
        .set({ payload: JSON.stringify(application.payload) })
        .where(and(eq(applications.id, application.id), eq(applications.status, "pending")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Application.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update application")
    }
  }

  /**
   * 申請を削除する。承認記録も併せて削除する。
   * pending 以外の申請は削除できない（0 行削除で null を返す）。
   * D1 batch でアトミックに削除し、中途失敗による orphan を防ぐ。
   */
  async delete(applicationId: number): Promise<true | null | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          "DELETE FROM application_requests WHERE id = ?1 AND status = 'pending'",
        ).bind(applicationId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          "DELETE FROM application_workflow_approvals WHERE application_id = ?1",
        ).bind(applicationId),
        this.c.env.DB.prepare(
          "DELETE FROM application_workflow_instances WHERE application_id = ?1",
        ).bind(applicationId),
        this.c.env.DB.prepare("DELETE FROM application_approvals WHERE application_id = ?1").bind(
          applicationId,
        ),
      ])

      return true
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return null
      }
      return error instanceof Error ? error : new Error("failed to delete application")
    }
  }

  /** 指定テンプレートに紐づく pending 状態の申請数を返す。 */
  async countPendingByTemplateId(templateId: number): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ value: count() })
        .from(applications)
        .where(and(eq(applications.templateId, templateId), eq(applications.status, "pending")))

      return rows.at(0)?.value ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count pending applications")
    }
  }

  /** 承認/却下の記録は申請集約に属するため、申請リポジトリが永続化する。 */
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

  /**
   * status の条件付き UPDATE と承認記録 INSERT を D1 batch でアトミックに行う。
   * 決定済み（0 行更新）は null を返す。batch 全体が失敗すると rollback される。
   */
  async decideFromPendingWithApproval(props: {
    applicationId: number
    status: "approved" | "rejected"
    approval: ApplicationApproval
  }): Promise<Application | null | Error> {
    try {
      const results = await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `
          UPDATE application_requests
          SET status = ?2, current_step = NULL
          WHERE id = ?1
            AND status = 'pending'
          RETURNING
            id, template_id AS templateId, applicant_id AS applicantId,
            status, current_step AS currentStep, payload, created_at AS createdAt
          `,
        ).bind(props.applicationId, props.status),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          `
          INSERT INTO application_approvals (application_id, approver_id, action, comment, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5)
          `,
        ).bind(
          props.approval.applicationId,
          props.approval.approverId,
          props.approval.action,
          props.approval.comment,
          props.approval.createdAt,
        ),
      ])

      const decideResult = results.at(0)
      const row = decideResult?.results?.at(0) as
        | Parameters<typeof Application.fromRow>[0]
        | undefined

      if (row === undefined) {
        return null
      }

      return Application.fromRow(row)
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return null
      }
      return error instanceof Error ? error : new Error("failed to decide application")
    }
  }
}
