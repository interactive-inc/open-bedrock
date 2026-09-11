import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import type { Context } from "@/env"
import { knowledgeArticles } from "@/contexts/knowledge/infrastructure/schema/knowledge"
import { eq } from "drizzle-orm"

export class KnowledgeArticleRepository {
  constructor(private readonly c: Context) {}

  /** 記事 id で1件取得する。存在しなければ null。 */
  async findById(id: number): Promise<KnowledgeArticle | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(knowledgeArticles)
        .where(eq(knowledgeArticles.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : KnowledgeArticle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load knowledge_article")
    }
  }

  /** 初版・本文・監査をまとめて保存し、再送では元の作成結果を返す。 */
  async createWithHistory(
    article: KnowledgeArticle,
    input: Readonly<{
      actorAccountId: string
      commandId: string
      reason: string
      requestJson: string
      at: Date
      assertions: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<KnowledgeArticle | null | Error> {
    if (
      article.id !== null ||
      article.revision !== 1 ||
      article.status !== "active" ||
      input.assertions.length === 0
    )
      return new Error("invalid knowledge creation")
    const db = this.c.env.DB
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await this.readRecordedCommand(input)
      if (previous instanceof Error) return previous
      if (previous !== null)
        return previous.requestJson === input.requestJson ? previous.article : null
      try {
        const id = await db
          .prepare("SELECT coalesce(max(id),0)+1 AS id FROM knowledge_articles")
          .first<number>("id")
        if (id === null || !Number.isSafeInteger(id) || id < 1)
          return new Error("knowledge identity unavailable")
        const saved = KnowledgeArticle.restore({ ...article.toJSON(), id })
        const snapshot = JSON.stringify(saved)
        const audit = SystemAuditEventEntity.create({
          actorAccountId: input.actorAccountId,
          action: "knowledge.create",
          targetType: "knowledge_article",
          targetId: String(id),
          outcome: "succeeded",
          reasonCode: null,
          authorizationJson: JSON.stringify({ policy: "author" }),
          beforeJson: null,
          afterJson: snapshot,
          metadataJson: JSON.stringify({ commandId: input.commandId, reason: input.reason }),
          occurredAt: input.at,
        })
        if (audit instanceof Error) return audit
        const statements = [
          ...input.assertions,
          db
            .prepare(
              "SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM knowledge_articles WHERE id=?1) THEN 1 ELSE json_extract('{}','knowledge_creation_conflict') END",
            )
            .bind(id),
          db
            .prepare(`INSERT INTO knowledge_articles(id,title,category,tags,body_md,author_id,created_at,revision,status)
            VALUES (?1,?2,?3,?4,?5,?6,?7,1,'active')`)
            .bind(
              id,
              article.title,
              article.category,
              article.tags,
              article.bodyMd,
              article.authorId,
              article.createdAt,
            ),
          db
            .prepare(`INSERT INTO knowledge_article_revisions(article_id,revision,snapshot_json,status,source,actor_account_id,reason,recorded_at,command_id,request_json)
            VALUES (?1,1,?2,'active','actor',?3,?4,?5,?6,?7)`)
            .bind(
              id,
              snapshot,
              input.actorAccountId,
              input.reason,
              input.at.getTime(),
              input.commandId,
              input.requestJson,
            ),
          ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
          db
            .prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM knowledge_articles WHERE id=?1 AND revision=1 AND status='active'
            AND title=?2 AND category=?3 AND tags IS ?4 AND body_md=?5 AND author_id=?6 AND created_at=?7)
            THEN 1 ELSE json_extract('{}','knowledge_creation_inconsistent') END`)
            .bind(
              id,
              article.title,
              article.category,
              article.tags,
              article.bodyMd,
              article.authorId,
              article.createdAt,
            ),
        ]
        await db.batch(statements)
        return saved
      } catch (cause) {
        const repeated = await this.readRecordedCommand(input)
        if (repeated instanceof Error) return repeated
        if (repeated !== null)
          return repeated.requestJson === input.requestJson ? repeated.article : null
        if (cause instanceof Error && cause.message.includes("knowledge_creation_conflict"))
          continue
        return new Error("knowledge creation unavailable", { cause })
      }
    }
    return new Error("knowledge creation contention")
  }

  /** 後続の改訂後も、同じ操作の再送には保存済みの結果を返す。現在の認可は毎回照合する。 */
  async readRecordedCommand(
    input: Readonly<{
      actorAccountId: string
      commandId: string
      assertions: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<Readonly<{ article: KnowledgeArticle; requestJson: string }> | null | Error> {
    if (
      input.assertions.length === 0 ||
      input.commandId.trim() === "" ||
      input.actorAccountId.trim() === ""
    )
      return new Error("invalid knowledge command lookup")
    try {
      const results = await this.c.env.DB.batch<{ snapshot_json: string; request_json: string }>([
        ...input.assertions,
        this.c.env.DB.prepare(`SELECT snapshot_json,request_json FROM knowledge_article_revisions
          WHERE actor_account_id=?1 AND command_id=?2`).bind(input.actorAccountId, input.commandId),
      ])
      if (results.some((result) => !result.success))
        return new Error("knowledge command authorization failed")
      const row = results.at(-1)?.results.at(0)
      if (row === undefined) return null
      return {
        article: KnowledgeArticle.restore(JSON.parse(row.snapshot_json)),
        requestJson: row.request_json,
      }
    } catch (cause) {
      return new Error("knowledge replay unavailable", { cause })
    }
  }

  /** 確認した版からの改訂・取下げと、その本文・操作記録を同じtransactionで保存する。 */
  async appendRevision(
    article: KnowledgeArticle,
    input: Readonly<{
      expectedRevision: number
      actorAccountId: string
      commandId: string
      reason: string
      requestJson: string
      at: Date
      assertions: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<KnowledgeArticle | null | Error> {
    if (
      article.id === null ||
      article.revision !== input.expectedRevision + 1 ||
      input.assertions.length === 0 ||
      input.commandId.trim() === "" ||
      input.reason.trim() === "" ||
      input.reason.length > 2000 ||
      !Number.isSafeInteger(input.at.getTime())
    )
      return new Error("invalid knowledge revision")
    const db = this.c.env.DB
    const replay = async (): Promise<KnowledgeArticle | null | Error | undefined> => {
      const saved = await this.readRecordedCommand(input)
      if (saved instanceof Error) return saved
      if (saved === null) return undefined
      if (saved.article.id !== article.id || saved.requestJson !== input.requestJson) return null
      return saved.article
    }
    const previous = await replay()
    if (previous !== undefined) return previous
    const snapshotJson = JSON.stringify(article)
    const audit = SystemAuditEventEntity.create({
      actorAccountId: input.actorAccountId,
      action: article.status === "withdrawn" ? "knowledge.withdraw" : "knowledge.revise",
      targetType: "knowledge_article",
      targetId: String(article.id),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        policy: "author",
        expectedRevision: input.expectedRevision,
      }),
      beforeJson: JSON.stringify({ revision: input.expectedRevision }),
      afterJson: snapshotJson,
      metadataJson: JSON.stringify({ commandId: input.commandId, reason: input.reason }),
      occurredAt: input.at,
    })
    if (audit instanceof Error) return audit
    const changed = () =>
      db.prepare(
        "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('{}','knowledge_revision_conflict') END",
      )
    try {
      const statements = [
        ...input.assertions,
        db
          .prepare(`INSERT INTO knowledge_article_revisions
          (article_id,revision,snapshot_json,status,source,actor_account_id,reason,recorded_at,command_id,request_json)
          SELECT id,?2,?3,?4,'actor',?5,?6,?7,?8,?9 FROM knowledge_articles
          WHERE id=?1 AND revision=?10 AND status='active' AND author_id=?11 AND created_at=?12`)
          .bind(
            article.id,
            article.revision,
            snapshotJson,
            article.status,
            input.actorAccountId,
            input.reason,
            input.at.getTime(),
            input.commandId,
            input.requestJson,
            input.expectedRevision,
            article.authorId,
            article.createdAt,
          ),
        changed(),
        db
          .prepare(`UPDATE knowledge_articles SET title=?2,category=?3,tags=?4,body_md=?5,revision=?6,status=?7
          WHERE id=?1 AND revision=?8 AND status='active'`)
          .bind(
            article.id,
            article.title,
            article.category,
            article.tags,
            article.bodyMd,
            article.revision,
            article.status,
            input.expectedRevision,
          ),
        changed(),
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
        db
          .prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM knowledge_articles article JOIN knowledge_article_revisions history
            ON history.article_id=article.id AND history.revision=article.revision
          WHERE article.id=?1 AND article.revision=?2 AND article.title=?3 AND article.category=?4
            AND article.tags IS ?5 AND article.body_md=?6 AND article.author_id=?7 AND article.created_at=?8
            AND article.status=?9 AND history.snapshot_json=?10 AND history.actor_account_id=?11
            AND history.command_id=?12 AND history.request_json=?13
          ) THEN 1 ELSE json_extract('{}','knowledge_revision_inconsistent') END`)
          .bind(
            article.id,
            article.revision,
            article.title,
            article.category,
            article.tags,
            article.bodyMd,
            article.authorId,
            article.createdAt,
            article.status,
            snapshotJson,
            input.actorAccountId,
            input.commandId,
            input.requestJson,
          ),
      ]
      await db.batch(statements)
      return article
    } catch (cause) {
      const repeated = await replay()
      if (repeated !== undefined) return repeated
      if (cause instanceof Error && cause.message.includes("knowledge_revision_conflict"))
        return null
      return new Error("knowledge revision unavailable", { cause })
    }
  }
}
