import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import type { IdentityProvider } from "@/contexts/system/domain/identity/identity-provider"
import type { IdentitySubject } from "@/contexts/system/domain/identity/identity-subject"

/**
 * システム層のテーブル定義。
 *
 * Account・Identity・認証・監査・通知を扱う。利用側の人物・組織・業務モデルには依存せず、
 * 他製品へそのまま持ち出せる層とする。層の定義は .docs/drafts/namespace-map.md が正本。
 *
 * relations はこのファイルに置かない。層をまたぐ relations が循環 import を生むため、
 * 97 個すべてを schema/relations.ts に集約している (同ファイル冒頭の説明を参照)。
 *
 * #3182 で下位 context のロール・招待・通知スコープを所有側へ移し、System から下位層への
 * import / FK をゼロにした。通知本体は System、リソーススコープは利用側の satellite が持つ。
 */

/**
 * Account。Identity 境界のアンカーで、無効化状態とtoken失効世代だけを保持する。
 * 表示名は利用側のプロフィールが所有し、System Accountへ保存しない。
 * 認証手段(password/Google/etc.) は user_identities が管理する。
 * 利用側の人物プロフィールやメンバーシップは Account ID を外部キーとして参照し、System 側に
 * 逆向きポインタを持たせない。
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  // 権限割当の変更時刻 (IAM RBAC)。ロール割当の編集時に現在時刻を書き込むだけで、
  // 参照箇所はまだ無い。将来のセッション再評価・キャッシュ無効化用の予約 (#1104)。
  permissionsChangedAt: integer("permissions_changed_at", { mode: "timestamp_ms" }),
  // 無効化時刻 (#845)。null = 有効。立っているとログイン 403、既存セッションも
  // authMiddleware / session API で拒否される（migration 0063）
  disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
  // access token の即時失効世代。新規 token はこの値を claim に持ち、DB と不一致なら拒否する。
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

/**
 * IAM bootstrap の完了記録。singleton=1 の 1 行だけを許し、初期ユーザー作成と同じ
 * D1 batch へ含めることで、並行リクエストでも複数の初期管理者が成立しないようにする。
 *
 * completedByUserId は restrict のままにして、通常のアカウント削除で bootstrap 済み状態が
 * 消えないようにする。災害復旧時もこの行や users を直接編集せず、正式な復旧手順を使う。
 */
export const bootstrapState = sqliteTable(
  "bootstrap_state",
  {
    singleton: integer("singleton").primaryKey(),
    completedByUserId: text("completed_by_user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [check("bootstrap_state_singleton_check", sql`${table.singleton} = 1`)],
)

/**
 * 認証手段 (identity)。1 ユーザーが複数の認証手段を持てる (#935 + #98x):
 * - provider="password" + provider_subject=email + password_hash 設定 → メールパスワード認証
 * - provider="google" + provider_subject=Google sub (subject id) → Google OAuth
 * - provider="microsoft" / "github" / ... → 将来の OAuth プロバイダ
 * - provider="magic_link" / "sms" → 将来の他認証手段
 *
 * (provider, provider_subject) で UNIQUE。同じ Google アカウントを複数 user_id に紐付け不可。
 * email カラムは表示・検索用。password provider では provider_subject と一致、OAuth では
 * provider 由来のメールが入る (verified ステータスはここで管理)。
 *
 * can_receive_email は「この email に実際にメールが届くか」を表す (#1306)。実在アドレスは true、
 * 機械発番アドレスは false。メール到達を前提にした導線は false の identity を弾き、
 * 管理画面での初期パスワード発行に誘導する。ドメイン文字列から推測せず明示フラグを正とする。
 */
export const userIdentities = sqliteTable(
  "user_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().$type<IdentityProvider>(),
    providerSubject: text("provider_subject").notNull().$type<IdentitySubject>(),
    email: text("email"),
    passwordHash: text("password_hash"),
    // メール到達可否 (#1306)。既存 identity は実メール前提なので default true でバックフィルする。
    canReceiveEmail: integer("can_receive_email", { mode: "boolean" }).notNull().default(true),
    emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
    // パスワード変更時刻 (#807)。password provider のみ使う。
    // JWT iat と比較して、変更前のトークンを失効させる。
    passwordChangedAt: integer("password_changed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  // 名前は D1 実体に合わせる (#2525)。0084 が付けた名前を 0085 のテーブル再構築が別名で作り直したため、
  // 宣言側が 0084 の名前のままずれていた。migration で rename すると全環境で drop + create が走るので、
  // 実体 (0085 が作った名前) に宣言を寄せる。email の 1 本は 0085 で再作成が漏れており 0217 で復旧した。
  (table) => [
    uniqueIndex("user_identities_provider_subject_unique").on(
      table.provider,
      table.providerSubject,
    ),
    index("user_identities_user_id_idx").on(table.userId),
    index("user_identities_by_email").on(table.email),
  ],
)

/**
 * OIDC Authorization Code Flow の短命な認可コード。
 *
 * ブラウザへ返す code 自体は保存せず SHA-256 hash だけを保持する。token endpoint は
 * issuer / client / redirect URI / PKCE challenge / expiry をすべて WHERE に含めた条件付き
 * DELETE + RETURNING で一度だけ消費し、並行交換でも後発を必ず拒否する。
 */
export const oidcAuthorizationCodes = sqliteTable(
  "oidc_authorization_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    issuer: text("issuer").notNull(),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeChallenge: text("code_challenge").notNull(),
    nonce: text("nonce").notNull(),
    scope: text("scope").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("oidc_authorization_codes_expires_at_idx").on(table.expiresAt)],
)

/**
 * OIDC UserInfo 用の短命 bearer token。token は認可コードと同じく hash のみ保存する。
 *
 * ConsoleはID Token検証後に自前のopaque sessionへ交換するためrefresh tokenは発行しない。
 * 漏えい時の利用窓を狭めるためaccess tokenも5分で失効する。
 */
export const oidcAccessTokens = sqliteTable(
  "oidc_access_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    issuer: text("issuer").notNull(),
    clientId: text("client_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("oidc_access_tokens_expires_at_idx").on(table.expiresAt)],
)

/**
 * 物理削除のアーカイブ台帳。削除実行時に対象エンティティと関連行のスナップショット (JSON) を
 * ここへ残してから本体を DELETE する。FK は張らない (deleted_by のユーザー自身も後から削除され得る)。
 */
export const deletedRecords = sqliteTable(
  "deleted_records",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: text("payload").notNull(),
    deletedBy: text("deleted_by"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("deleted_records_entity_idx").on(table.entityType, table.entityId),
    index("deleted_records_deleted_at_idx").on(table.deletedAt),
  ],
)

/**
 * UUID 移行前の内部 ID と、DB に保存する UUID の対応表。
 *
 * legacyId は過去 URL・移行前セッション・DB 外部キーの読み替え専用で、新規採番には使わない。
 * entityTable は generic alias の参照先を監査できるように保持する注釈であり、動的 FK にはしない。
 */
export const entityIdAliases = sqliteTable(
  "entity_id_aliases",
  {
    legacyId: text("legacy_id").primaryKey(),
    entityTable: text("entity_table").notNull(),
    entityId: text("entity_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("entity_id_aliases_entity_id_unique").on(table.entityId),
    index("entity_id_aliases_entity_table_idx").on(table.entityTable),
    check(
      "entity_id_aliases_entity_id_uuid_check",
      sql`
        length(${table.entityId}) = 36
        AND ${table.entityId} = lower(${table.entityId})
        AND substr(${table.entityId}, 9, 1) = '-'
        AND substr(${table.entityId}, 14, 1) = '-'
        AND substr(${table.entityId}, 19, 1) = '-'
        AND substr(${table.entityId}, 24, 1) = '-'
        AND replace(${table.entityId}, '-', '') NOT GLOB '*[^0-9a-f]*'
        AND substr(${table.entityId}, 15, 1) GLOB '[1-8]'
        AND substr(${table.entityId}, 20, 1) GLOB '[89ab]'
      `,
    ),
  ],
)

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("audit_logs_user_idx").on(table.userId),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
  ],
)
