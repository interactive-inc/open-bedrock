import { Application } from "@/domain/application/application"
import { ApplicationApproval } from "@/domain/application/application-approval"
import type { Context } from "@/env"
import { applicationApprovals, applications } from "@/schema"
import { and, desc, eq } from "drizzle-orm"

export class ApplicationRepository {
  constructor(private readonly c: Context) {}

  // 申請者本人の申請を作成日時の降順で返す。
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
        opts !== undefined ? await query.limit(opts.limit).offset(opts.offset) : await query

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

  // 承認/却下を pending からの条件付き UPDATE で確定する。決定済みは 0 行更新となり null を返す。
  // 二重決定を防ぐ冪等性ガード（TOCTOU 競合にも強い）。確定時は current_step も外す。
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

  // 申請内容（payload）を更新する。status や currentStep は変更しない。
  async updatePayload(application: Application): Promise<Application | null | Error> {
    try {
      if (application.id === null) {
        return new Error("cannot update unsaved application")
      }

      const rows = await this.c.var.database
        .update(applications)
        .set({ payload: JSON.stringify(application.payload) })
        .where(eq(applications.id, application.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Application.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update application")
    }
  }

  // 申請を削除する。承認記録も併せて削除する。
  async delete(applicationId: number): Promise<null | Error> {
    try {
      await this.c.var.database.batch([
        this.c.var.database
          .delete(applicationApprovals)
          .where(eq(applicationApprovals.applicationId, applicationId)),
        this.c.var.database.delete(applications).where(eq(applications.id, applicationId)),
      ])

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete application")
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

  // status の条件付き UPDATE と承認記録 INSERT を D1 batch でアトミックに行う。
  // 決定済み（0 行更新）は null を返す。batch 全体が失敗すると rollback される。
  async decideFromPendingWithApproval(props: {
    applicationId: number
    status: "approved" | "rejected"
    approval: ApplicationApproval
  }): Promise<Application | null | Error> {
    try {
      const results = await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `
          UPDATE applications
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

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}

// ガード文（abortWhenPreviousStatementChangedNoRows）の json_extract('', '$') による
// 意図的な abort かを判定する。これ以外の batch 失敗は本物の DB エラーとして伝播させる。
function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
