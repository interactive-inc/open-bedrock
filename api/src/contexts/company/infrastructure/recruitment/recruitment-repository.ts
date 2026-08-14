import { RecruitmentPosition } from "@/domain/recruitment/recruitment-position.entity"
import { RecruitmentCandidate } from "@/domain/recruitment/recruitment-candidate.entity"
import type { Context } from "@/env"
import { recruitmentCandidates, recruitmentPositions } from "@/schema"
import { asc, count, desc, eq } from "drizzle-orm"

export class RecruitmentRepository {
  constructor(private readonly c: Context) {}

  async listPositions(props: {
    status: "open" | "closed" | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<RecruitmentPosition> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(recruitmentPositions)
        .where(props.status === null ? undefined : eq(recruitmentPositions.status, props.status))
        .orderBy(desc(recruitmentPositions.createdAt))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => RecruitmentPosition.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load recruitment_positions")
    }
  }

  async countPositions(status: "open" | "closed" | null): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(recruitmentPositions)
        .where(status === null ? undefined : eq(recruitmentPositions.status, status))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count recruitment_positions")
    }
  }

  async findPositionById(id: number): Promise<RecruitmentPosition | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(recruitmentPositions)
        .where(eq(recruitmentPositions.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : RecruitmentPosition.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to find recruitment_position")
    }
  }

  async createPosition(position: RecruitmentPosition): Promise<RecruitmentPosition | Error> {
    try {
      const rows = await this.c.var.database
        .insert(recruitmentPositions)
        .values({
          title: position.title,
          departmentCode: position.departmentCode,
          status: position.status,
          note: position.note,
          createdAt: position.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create recruitment_position")
        : RecruitmentPosition.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create recruitment_position")
    }
  }

  async updatePosition(
    id: number,
    position: RecruitmentPosition,
  ): Promise<RecruitmentPosition | Error> {
    try {
      const rows = await this.c.var.database
        .update(recruitmentPositions)
        .set({
          title: position.title,
          departmentCode: position.departmentCode,
          status: position.status,
          note: position.note,
        })
        .where(eq(recruitmentPositions.id, id))
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to update recruitment_position")
        : RecruitmentPosition.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update recruitment_position")
    }
  }

  async listCandidatesByPosition(props: {
    positionId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<RecruitmentCandidate> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(recruitmentCandidates)
        .where(eq(recruitmentCandidates.positionId, props.positionId))
        .orderBy(asc(recruitmentCandidates.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => RecruitmentCandidate.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load recruitment_candidates")
    }
  }

  async countCandidatesByPosition(positionId: number): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(recruitmentCandidates)
        .where(eq(recruitmentCandidates.positionId, positionId))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count recruitment_candidates")
    }
  }

  async findCandidateById(id: number): Promise<RecruitmentCandidate | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(recruitmentCandidates)
        .where(eq(recruitmentCandidates.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : RecruitmentCandidate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to find recruitment_candidate")
    }
  }

  async createCandidate(candidate: RecruitmentCandidate): Promise<RecruitmentCandidate | Error> {
    try {
      const rows = await this.c.var.database
        .insert(recruitmentCandidates)
        .values({
          positionId: candidate.positionId,
          name: candidate.name,
          email: candidate.email,
          source: candidate.source,
          stage: candidate.stage,
          note: candidate.note,
          createdAt: candidate.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create recruitment_candidate")
        : RecruitmentCandidate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create recruitment_candidate")
    }
  }

  async updateCandidate(
    id: number,
    candidate: RecruitmentCandidate,
  ): Promise<RecruitmentCandidate | Error> {
    try {
      const rows = await this.c.var.database
        .update(recruitmentCandidates)
        .set({
          name: candidate.name,
          email: candidate.email,
          source: candidate.source,
          stage: candidate.stage,
          note: candidate.note,
        })
        .where(eq(recruitmentCandidates.id, id))
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to update recruitment_candidate")
        : RecruitmentCandidate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update recruitment_candidate")
    }
  }
}
