import { Document } from "@/contexts/document/domain/entities/document.entity"
import type { Context } from "@/env"
import { documents } from "@/contexts/document/infrastructure/schema/document"
import { eq } from "drizzle-orm"

export class DocumentRepository {
  constructor(private readonly c: Context) {}

  async findById(id: number): Promise<Document | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Document.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load document")
    }
  }

  async create(document: Document): Promise<Document | Error> {
    try {
      const rows = await this.c.var.database
        .insert(documents)
        .values({
          title: document.title,
          category: document.category,
          location: document.location,
          partnerCode: document.partnerCode,
          expiresOn: document.expiresOn,
          note: document.note,
          createdAt: document.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert document") : Document.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert document")
    }
  }

  async update(document: Document): Promise<Document | null | Error> {
    try {
      if (document.id === null) {
        return new Error("cannot update unsaved document")
      }

      const rows = await this.c.var.database
        .update(documents)
        .set({
          title: document.title,
          category: document.category,
          location: document.location,
          partnerCode: document.partnerCode,
          expiresOn: document.expiresOn,
          note: document.note,
        })
        .where(eq(documents.id, document.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Document.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update document")
    }
  }
}
