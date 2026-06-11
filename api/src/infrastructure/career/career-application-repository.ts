import { CareerApplication } from "@/domain/career/career-application"
import type { Context } from "@/env"
import { careerApplications } from "@/schema"
import { and, asc, count, eq, sql } from "drizzle-orm"

export type AlreadyAppliedError = { reason: "already_applied" }

export type PostingClosedError = { reason: "posting_closed" }

export type ApplicationDecidedError = { reason: "application_decided" }

export class CareerApplicationRepository {
  constructor(private readonly c: Context) {}

  // 公募が open のときだけ INSERT する。公募が closed なら posting_closed、重複なら already_applied を返す。
  // INSERT ... SELECT ... WHERE EXISTS で公募ステータス確認と INSERT をアトミックに行い TOCTOU を防ぐ。
  async create(
    careerApplication: CareerApplication,
  ): Promise<CareerApplication | AlreadyAppliedError | PostingClosedError | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO career_applications (posting_id, applicant_id, message, status)
            SELECT ${careerApplication.postingId}, ${careerApplication.applicantId},
                   ${careerApplication.message}, ${careerApplication.status}
            WHERE EXISTS (
              SELECT 1 FROM career_postings
              WHERE id = ${careerApplication.postingId} AND status = 'open'
            )`,
      )

      if (result.meta.changes === 0) {
        return { reason: "posting_closed" }
      }

      // last_insert_rowid で採番された行を取得する
      const rows = await this.c.var.database
        .select()
        .from(careerApplications)
        .where(eq(careerApplications.id, Number(result.meta.last_row_id)))
        .limit(1)

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to retrieve inserted career application")
        : CareerApplication.fromRow(row)
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return { reason: "already_applied" }
      }
      return error instanceof Error ? error : new Error("failed to insert career application")
    }
  }

  // 応募者本人の応募を id の昇順で返す。
  async findByApplicantId(props: {
    applicantId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<CareerApplication> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(careerApplications)
        .where(eq(careerApplications.applicantId, props.applicantId))
        .orderBy(asc(careerApplications.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => CareerApplication.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load career_applications")
    }
  }

  // 応募 id で1件取得する。存在しなければ null。
  async findById(id: number): Promise<CareerApplication | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(careerApplications)
        .where(eq(careerApplications.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : CareerApplication.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load career_application")
    }
  }

  // 応募メッセージを更新する。status = 'applied' のときだけ更新を許可し、
  // 選考確定済み（accepted/rejected）の応募は null を返す。
  async update(
    careerApplication: CareerApplication,
  ): Promise<CareerApplication | ApplicationDecidedError | Error> {
    if (careerApplication.id === null) {
      return new Error("cannot update an unsaved career application")
    }

    try {
      const result = await this.c.var.database.run(
        sql`UPDATE career_applications
            SET message = ${careerApplication.message}
            WHERE id = ${careerApplication.id}
              AND status = 'applied'`,
      )

      if (result.meta.changes === 0) {
        return { reason: "application_decided" }
      }

      return careerApplication
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update career_application")
    }
  }

  // 応募を削除する。status = 'applied' のときだけ削除を許可し、
  // 選考確定済み（accepted/rejected）の応募は application_decided を返す。
  async delete(id: number): Promise<null | ApplicationDecidedError | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`DELETE FROM career_applications
            WHERE id = ${id}
              AND status = 'applied'`,
      )

      if (result.meta.changes === 0) {
        return { reason: "application_decided" }
      }

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete career_application")
    }
  }

  // 指定した求人に対して指定ステータスの応募件数を返す。
  async countByPostingIdAndStatus(
    postingId: number,
    status: CareerApplication["status"],
  ): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ value: count() })
        .from(careerApplications)
        .where(
          and(eq(careerApplications.postingId, postingId), eq(careerApplications.status, status)),
        )

      return rows.at(0)?.value ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count career_applications")
    }
  }

  async findByPostingAndApplicant(
    postingId: number,
    applicantId: number,
  ): Promise<CareerApplication | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(careerApplications)
        .where(
          and(
            eq(careerApplications.postingId, postingId),
            eq(careerApplications.applicantId, applicantId),
          ),
        )
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : CareerApplication.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load career_application")
    }
  }
}
