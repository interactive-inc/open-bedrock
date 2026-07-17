import { Position } from "@/domain/position/position.entity"
import type { Context } from "@/env"
import { employees, positions } from "@/schema"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { asc, eq } from "drizzle-orm"

export class PositionRepository {
  constructor(private readonly c: Context) {}

  // 役職マスタを rank の昇順で返す。
  async findAll(props: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Position> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(positions)
        .orderBy(asc(positions.rank))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => Position.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load positions")
    }
  }

  async count(): Promise<number | Error> {
    try {
      const rows = await this.c.var.database.select().from(positions)

      return rows.length
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count positions")
    }
  }

  async findById(positionId: number): Promise<Position | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(positions)
        .where(eq(positions.id, positionId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Position.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load position")
    }
  }

  async findByCode(code: string): Promise<Position | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(positions)
        .where(eq(positions.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Position.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load position")
    }
  }

  // 役職名を現に使っている従業員（employees.position が一致）の件数を返す。
  async countEmployeesByPositionName(name: string): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.position, name))

      return rows.length
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count employees by position")
    }
  }

  async create(position: Position): Promise<Position | Error> {
    try {
      const rows = await this.c.var.database
        .insert(positions)
        .values({
          code: position.code,
          name: position.name,
          rank: position.rank,
          description: position.description,
          createdAt: position.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to create position") : Position.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("position code already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to create position")
    }
  }

  async update(position: Position): Promise<Position | null | Error> {
    try {
      if (position.id === null) {
        return new Error("cannot update unsaved position")
      }

      const rows = await this.c.var.database
        .update(positions)
        .set({
          code: position.code,
          name: position.name,
          rank: position.rank,
          description: position.description,
        })
        .where(eq(positions.id, position.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Position.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("position code already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to update position")
    }
  }

  async delete(positionId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(positions).where(eq(positions.id, positionId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete position")
    }
  }
}
