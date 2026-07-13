# IAM 認証・認可システム 設計

複数アカウント認証 + 動的ロール(IAM) + 機能別権限 + 権限ベースサイドバーの実装青写真。
3つの設計観点(security-first / pragmatic / clean-iam)を統合して確定したもの。

## 統合方針

security-first(JWT に権限を載せずサーバ側 DB 解決一本化・refresh ローテ + tokenVersion 失効・OAuth は sub 固定)を骨格に、pragmatic(can-\* シグネチャ温存・migration 連番・SSOT permission-keys・KV 活用)と clean-iam(accounts/identities/roles/permissions/role_permissions/account_roles 完全分離)を統合。

fail-open は一切採用しない。認可解決失敗・未知 permission キーは常に deny(fail-closed)。最終的に employees.email/password_hash/role の3列を撤去し employees は純台帳に戻す。D1/SQLite では FK 制約を張らず論理参照 + unique/部分 index で担保。

## データモデル(新規8テーブル)

- **accounts**: id / employeeId(論理FK, null可) / status(active|suspended|locked) / tokenVersion(default 0) / createdAt / updatedAt。部分 uniqueIndex(employeeId) where NOT NULL で 1従業員=1アカウント。
- **identities**: id / accountId / provider(password|google|github|oidc) / subject(password=正規化email, OAuth=sub) / secret(PBKDF2のみ, null可) / email(null可) / emailVerified(default 0) / lastUsedAt / createdAt。uniqueIndex(provider, subject)。
- **roles**: id / key(unique, 不変) / name / description / isSystem(default 0) / createdAt。
- **permissions**: id / key(unique, "<domain>:<action>[:<scope>]") / description / category。正はコードの PERMISSION_KEYS、テーブルは UI 用の写し。
- **rolePermissions**: roleId / permissionId。PK(roleId, permissionId)。
- **accountRoles**: accountId / roleId / grantedBy(null可) / grantedAt。PK(accountId, roleId)。複数ロール可、実効 permission は和集合。
- **refreshTokens**: id / accountId(index) / tokenHash(unique, SHA-256のみ) / familyId / tokenVersion / expiresAt / revokedAt / userAgent / createdAt。
- **auditLogs**(append-only): id / actorAccountId / action / targetType / targetId / metadata(JSON) / ip / createdAt。UPDATE/DELETE はアプリ層で禁止。

## permission カタログ

粒度 `<domain>:<action>[:<scope>]`。約40-50 permission。self スコープは permission に載せず所有者判定としてコードに残す(最小権限)。28 can-\* + goal-access 2 + インライン2 ≒ 32ゲートを起点に正規化。

system role 4値の再現: member=self中心(permission なし) / manager=担当組織内の承認と評価 / hr=manager + 全社設定、org:manage,employee:delete,thanks_reward:manage,thanks_redemption:approve / admin=全権 + employee:assign_role + iam:\* + account:manage。manager は全社の評価サイクルと申請テンプレートを変更しない。

per-template 動的ロール(approver_roles)は permission に正規化せず roleKey 参照として残す。

## 認証フロー

複数ログイン方法を identities の多態で吸収。全成功フロー: identity検証 → account取得 → status=active → employees.status が retired でない → access token(短命1時間) + refresh token(長命7日、ローテーション) 発行。

refresh は account の tokenVersion と refresh token 発行時の tokenVersion を照合する。ローテーションは旧トークンの未失効を条件に D1 batch で子トークン作成と旧トークン失効を原子的に行い、同時利用では1リクエストだけを成功させる。使用済みトークンの再利用を検出した場合は同じ familyId のトークンを全て失効する。

JWT claims = `{ accountId, employeeId, tokenVersion }` のみ(email/role/permission は載せない)。permission は verify-bearer が毎回 DB 解決(accountRoles⋈rolePermissions⋈permissions を1クエリ)して session に Set で展開。tokenVersion 不一致なら 401(即時失効)。

OAuth/OIDC: state(CSRF)+PKCE、sub 固定、id_token 検証、emailVerified=true かつ既存 password identity と email 一致時のみ自動リンク。

## 実装フェーズ

- **Phase 0**: PERMISSION_KEYS 定義、system role 許可集合確定、schema 追加(z.enum)、seed の role 乖離解消、subset チェック。
- **Phase 1**: 新8テーブルの migration + schema.ts 同期(無害、既存無変更)。
- **Phase 2**: backfill(各 employee に accounts/identities/account_roles を 1:1 生成、roles/permissions/role_permissions シード)。冪等。
- **Phase 3**: 認証カットオーバー(AuthenticateWithPassword、JWT claims 変更、verify-bearer 改修、refresh token)。
- **Phase 4**: 認可 permission 化(has-permission.ts、can-\* を canX(session) へ、Command.viewerRole→session)。
- **Phase 4.5**: per-template 動的ロール正規化(approver_roles/owner_role を roleKey 参照へ)。
- **Phase 5**: IAM/アカウント管理 API・画面・cli(/accounts, /roles, /permissions、escalation guard、last-admin 不変条件)。
- **Phase 6**: 権限ベースサイドバー(/me に permissions/role_keys、sidebar-nav に requiredPermission)。
- **Phase 7**: クリーンアップ(employees.email/password_hash/role drop、role 単一参照撤去)。

## セキュリティ要点

権限昇格防止(JWT に権限載せない / admin は実効全許可をコード固定 / ロール付与・剥奪・編集・削除とアカウント操作は実行者の権限集合の部分集合だけを対象にする / 自分に自分でロール付与を塞ぐ)、最小権限、トークン失効(1時間 + refresh ローテ + tokenVersion + 再利用時の family 失効)、監査(append-only)、OAuth 安全性(state+PKCE+sub固定)。

社員台帳の一覧と他者詳細は `employee:read` で保護する。社員選択が必要な一般業務画面では、在籍中社員のコード・氏名・部署・役職だけを返す `/directory/employees` を使い、メールアドレス、在籍状態、ロール、内部 ID は公開しない。

## 実装状況

Phase 0〜6 を実装・テスト済み。

- Phase 0〜2: permission カタログ・8テーブル・マスタシード・backfill 完了
- Phase 3: 認証を identities/accounts ベースへカットオーバー（JWT に権限を載せず DB 解決、tokenVersion 失効）
- Phase 4/4.5: 全 can-\* を permission ベースへ、承認の動的ロールを roleKeys 複数対応へ
- Phase 5: ロール管理 API（GET/POST /roles）、権限カタログ API（GET /permissions）、アカウント一覧 API（GET /accounts）、アカウントへのロール割当 API（POST /accounts/:id/roles、escalation guard・自己付与禁止・tokenVersion 失効）、/me の permissions/role_keys 返却、Web 管理画面（/admin/roles・/admin/accounts）、cli（karte roles・karte accounts）
- Phase 6: 権限ベースのサイドバー出し分け（filterByPermission）

- Phase 7: employees から email/password_hash/role を物理 drop（0006 migration）して純台帳化。完了。
  認証は identities、認可は account_roles、メールは identities.subject が正。employee API の email/role は
  IdentityRepository/AccountRepository で解決。register-employee は identity 払い出し、update-employee は
  台帳更新に縮小（ロール変更は Grant/Revoke AccountRole へ委譲）。dev seed は seeds/iam.sql で IAM を投入。

全8フェーズ完了。API・CLI の全テスト、API・Web・CLI の型検査、migrate（drop 含む）→ seed を継続的に確認する。

## 既知リスク

D1 に FK 無し(孤児行はアプリ層 + index + 監査)、permission 二重定義の同期ズレ(起動時 subset チェック)、二重正期間(Phase2-6)の整合、approver_roles の未知キー突合、admin 全許可固定の硬直、毎リクエスト join のレイテンシ、OR 結合は deny を表現できない、access token 1時間 + refresh token 7日。POST /auth/refresh でローテーション更新。
