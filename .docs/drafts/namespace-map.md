# 名前空間マップ

テーブル、URL、CLI コマンドの名前を全面的に定める。旧名は温存せず、別名も設けない。

テーブル名、URL、CLI コマンドはいずれも実装済みである。実装の現況は `api/src/interface/routes`、`cli/app`、`.docs/sitemap.md` を正とする。

URL と CLI の実装で本書から外れた点が三つある。いずれも本書の意図を保ったまま、実装上の制約に合わせたものである。

レポートラインは `/employees/:code/reporting-line` とした。本書は `:employee_code` を挙げるが、`/employees` 配下の既存経路が `:code` を使っており、同じ位置のセグメントに二つの名前を与えないことを優先した。

サンクスの残高と予算は一本化せず、別リソースへ分けた。`/thanks-point-budgets/me` が当月原資（送れる枠）を、`/thanks-point-balances/me` が受領残高（もらった点数の残り）を返す。当初は同一の表を読む二本と見なして一本化を提案したが、実装では読む対象が既に分かれており、両者は別概念である。詳細は「決定事項」の `thanks` の節に記す。

`/governance-documents/impact` は `/governance-documents/:code` より先に登録した。`impact` を documents 配下へ移したことで動的セグメントに飲まれるためで、経路の名前そのものは本書のとおりである。

## 命名原則

- リソース名の末尾は複数形にできる可算名詞とする。修飾語は単数形または集合名詞とする
- 名前に主語を含める。主語のない裸の名前を禁止する
- 名前空間は System、Company、App の優先順で確定する。上位は汎用名を汎用の意味で保持し、下位は上位の汎用名を占有しない
- 集合名詞は単独のリソース名にしない。集合名詞に可算の主名詞を補う

## 所有区分の定義

区分は System、Company、App とする。App の `default` と `opt-in` は既定の有効状態であり、所有区分ではない。定義と判定基準は [[feature-tiers|機能区分]] に従う。

### 優先順位の規則

名前の取り合いは上位が勝つ。上位が汎用名を単独で使い、下位は主語を付けて区別する。

`roles` は System が所有する。Company の組織上の責任ロールは `governance_org_roles` として主語を持つ。`notifications` は System が所有し、thanks App の通知は独自の表を持たない。System の証拠台帳は `document_ledger_entries`、regulation App は `regulations`、governance-document App は `governance_documents` として棲み分ける。

同じ所有区分の中で名前が競合する場合は、先に存在する概念が汎用名を保つのではなく、両方に主語を付ける。優先順位は所有区分をまたぐ競合にのみ適用する。

所有境界は概念と不変条件で引く。App は申請内容と業務実行を、System は汎用 Case、Task、Decision、approval、ExecutionAuthorization を、Company は判断者の会社上の資格を所有する。別の所有者が持つ表を同じ schema file または context に同居させない。

## System のテーブル

製品の業務内容から独立した基盤。停止できない。汎用名を優先して所有する。

### 改名するもの

`identity_login_jti` を `identity_login_tokens` にする。行の粒度は消費済みトークン 1 件であり、末尾が可算名詞でない。

`audit_logs` を `audit_events` にする。API は既に `/audit-events` を用いており、記録対象は個々の事象である。名前を事象側へ揃える。

`lifecycle_outbox` を `lifecycle_outbox_entries` にする。`outbox` は容器を表す集合名詞であり、行の粒度は送出待ちの効果 1 件である。

`permissions` は改名しない。理由は「決定事項」の `permissions` の節に記す。

### 変更しないもの

次はいずれも主語を含む複数形であり、System の汎用名として妥当である。

`accounts`、`identities`、`identity_login_tokens`、`cli_login_states`、`cli_login_codes`、`browser_login_codes`、`refresh_tokens`、`roles`、`role_permissions`、`account_roles`、`audit_events`、`audit_batch_decisions`、`batch_jobs`、`notifications`、`permissions`、`application_requests`、`application_templates`、`application_approvals`、`application_subjects`、`application_completion_bindings`、`application_workflows`、`application_workflow_revisions`、`application_workflow_instances`、`application_workflow_step_snapshots`、`application_workflow_step_candidates`、`application_workflow_approvals`、`application_workflow_events`、`approval_delegations`、`decision_records`、`document_ledger_entries`。

`roles`、`notifications`、`application_requests`、`decision_records` は System が汎用名を所有する例である。下位の区分は主語を付けて区別する。

`notifications` の受信者は `recipient_account_id` で Account を参照する。Company の Employee 宛て通知は `account_employee_links` で Account を解決してから作成し、System 側に Employee 識別子を保存しない。

`audit_events` は Principal 主体の汎用監査イベントだけを保存する。Employee 文脈は Company の `audit_event_employee_contexts` が所有する。

現行 System schema は 16 表である。申請、判断、証拠の表は現在 Company schema に同居しており、System へ移管する。

## Company のテーブル

会社である限り外せない必須基盤。停止すると製品が成立しない。

### 改名するもの

`applications` を `application_requests` にする。裸の `applications` は業務アプリケーションとも申請とも読め、公開リポジトリでは特に誤読しやすい。申請という主語を明示する。

`documents` を `document_ledger_entries` にする。この表は本体を保持せず所在と属性のみを台帳として持つ。`governance_documents` および `regulation_versions` と役割が異なることを名前で示す。

`decisions` を `decision_records` にする。裸の `decisions` は承認判断とも意思決定記録とも読める。この表は意思決定記録であり、承認判断は `application_approvals` と `audit_batch_decisions` が担う。

`organization_lifecycle_state` を `organization_lifecycle_states` にする。単一行制約は検査制約が担い、表名は他と同じ複数形に揃える。

`lifecycle_migration_state` を `lifecycle_migration_states` にする。理由は同上とする。

`org_assignment_period_versions` を `employee_org_assignment_period_versions` にする。行の主語は従業員であり、`org_` は所属先を指す修飾語にすぎない。`employment_period_versions` および `employee_status_period_versions` と主語を揃える。

`org_responsibility_period_versions` を `employee_org_responsibility_period_versions` にする。理由は同上とする。

`grades` を `grade_definitions` にする。定義の原簿であり、実績は `employee_grades` が担う。定義と実績を名前で分ける。

`positions` を `position_definitions` にする。理由は同上とする。役職の異動履歴は人事発令が担い、割当表を持たない。

### 変更しないもの

`employees`、`account_employee_links`、`audit_event_employee_contexts`、`departments`、`org_departments`、`org_memberships`、`employee_events`、`employee_grades`、`employment_period_versions`、`employee_status_period_versions`、`employee_lifecycle_revisions`、`personnel_actions`、`governance_capabilities`、`governance_org_roles`、`governance_org_role_assignments`。

`governance_org_roles` は System の `roles` と競合しないよう主語を持つ。この分離は既に成立しており維持する。

`company_audit_event_appends` は Company の監査書き込みを分配後に必ず削除する transaction adapter であり、永続リソースの表数には含めない。`company_audit_events` は System イベントと Company 文脈の互換 view である。

Company に同居する application workflow、onboarding、governance document、regulation、announcement、resignation request、certificate request の表は、それぞれ System または所有 App へ移管する。Company の最終表数は LegalEntity、Company profile、Office、ResponsibilityAssignment、CollectiveBody の不足を実装してから確定する。

## default App のテーブル

ほぼ全社が使うが停止できる機能。既定で有効とし、設定で停止できる。

### 改名するもの

`budgets` を `department_budgets` にする。行の粒度は部署と会計期間の組であり、主語が部署である。

`contracts` を `partner_contracts` にする。行は取引先に従属する。

`licenses` を `software_licenses` にする。裸の `licenses` は資格免許とも読める。この表はソフトウェアの利用権の台帳であり、資格は `certification_definitions` が担う。

`certifications` を `certification_definitions` にする。定義の原簿であり、保有実績は `employee_certifications` が担う。

`meeting_minutes` を `meeting_minutes_records` にする。`minutes` は複数形専用名詞であり行数と一致しない。行の粒度は開催 1 回分の議事録である。

`recruitment_positions` を `job_openings` にする。`position` の語を Company の `position_definitions` と共有すると、修飾語でしか区別が付かない。募集枠は役職の定義とは別概念であり、固有の語を与えて衝突自体を消す。`recruitment_candidates` は主語が候補者であり衝突しないため維持する。

`employee_work_styles` は変更しない。URL 側が主語を欠く `/work-styles` であるため、URL のみ主語を補う。

### 変更しないもの

`attendance_records`、`company_calendar_days`、`employee_work_styles`、`shift_patterns`、`shift_assignments`、`shift_swap_requests`、`leave_requests`、`leave_balances`、`payslips`、`salary_revisions`、`year_end_adjustments`、`expenses`、`expense_approvals`、`ringi_requests`、`assets`、`asset_lendings`、`stocktakes`、`stocktake_items`、`partners`、`employee_certifications`、`health_checkups`、`work_accidents`、`it_incidents`、`antisocial_checks`、`disciplinary_actions`、`commendations`、`recruitment_candidates`、`headcount_plans`、`meetings`、`life_events`、`family_care_leaves`、`business_trips`、`rooms`、`room_reservations`、`rental_reservations`。

`job_openings` への改名により `position` の語はシステム全体で `position_definitions` のみが用いる。同じ語を二つの概念が共有する状態を残さない。

現行の default App は 41 表を持つ。分離後は各 App が自身の表だけを所有する。

## opt-in App のテーブル

無くても会社が回る機能。既定で無効とし、有効化して使う。上位の汎用名を占有しない。

### 改名するもの

`thanks` を `thanks_messages` にする。行の粒度は送信 1 件である。関連する `thanks_point_budgets`、`thanks_rewards`、`thanks_redemptions` は既に可算であり維持する。

`goals` を `performance_goals` にする。裸の `goals` は経営目標とも個人目標とも読める。所有主体は個人、部門、全社にわたるため、制度としての名前を主語に置く。

`skills` を `skill_definitions` にする。定義の原簿であり、保有実績は `employee_skills` が担う。

### 変更しないもの

`one_on_ones`、`thanks_point_budgets`、`thanks_rewards`、`thanks_redemptions`、`goal_evaluations`、`employee_skills`、`knowledge_articles`、`career_postings`、`career_applications`、`career_sheets`、`training_courses`、`training_enrollments`、`review_cycles`、`review_forms`、`review_cycle_policies`、`surveys`、`survey_responses`。

`knowledge_articles` は `knowledge` が不可算だが修飾語の位置にあり、主名詞 `articles` が可算である。原則に適合する。

現行の opt-in App は 20 表を持つ。分離後は各 App が自身の表だけを所有する。

### 網羅性

現行の永続リソース表は合計 129 である。System の Drizzle 定義は `api/src/contexts/system/infrastructure/schema`、全体の合成は `api/src/schema.ts` に置く。分離後は各永続リソース表を一つの context だけが所有する。分配後に行を残さない `company_audit_event_appends` と互換 view は表数に含めない。

## URL

第一セグメントを複数形リソースに統一する。単数形のドメインディレクトリは、その配下の実体を主名詞として複数形に昇格させる。

URL は所有区分または有効状態を経路に含めない。`/apps/thanks-messages` または `/opt-in/thanks-messages` のような接頭辞を付けず、経路はリソース名だけで構成する。

### 単数ドメインの是正

`/attendance` を `/attendance-records` にする。配下は `clock-in`、`clock-out`、`me`、`me/summary`、`overtime-summary` とする。打刻は状態遷移の動詞 POST として `/attendance-records/clock-in` の形を維持する。

`/leave` を `/leave-requests` にする。現行の `/leave/requests` の二階層を一階層へ潰す。残高は主語が異なるため `/leave-balances` として独立させる。

`/shift` を分割する。`/shift/patterns` を `/shift-patterns`、`/shift/assignments` を `/shift-assignments`、`/shift/swap-requests` を `/shift-swap-requests` にする。三つは別のリソースであり、共通の親を持つ理由がない。

`/career` を分割する。`/career/postings` を `/career-postings`、`/career/applications` を `/career-applications`、`/career/sheet/me` を `/career-sheets/me` にする。`sheet` の単数形は 1 名につき 1 行である性質に由来するが、リソース名は複数形に統一し、単数性は `me` の指定で表す。

`/knowledge` を `/knowledge-articles` にする。テーブル名と一致させる。

`/ringi` を `/ringi-requests` にする。`ringi` 単独は可算名詞ではなく、実体は決裁の依頼である。

`/org` を分割する。`/org/departments` を `/departments`、`/org/tree` を `/departments/tree`、`/org/reporting-line/:employee_code` を `/employees/:employee_code/reporting-line` にする。報告線は従業員に従属する情報であり、従業員配下へ移す。

`/governance` は配下が複数の独立リソースを含むため分割する。`/governance/documents` を `/governance-documents`、`/governance/org-roles` を `/governance-org-roles`、`/governance/capabilities` を `/governance-capabilities`、`/governance/impact` を `/governance-documents/impact` にする。`governance` は修飾語として残り、単独のセグメントではなくなる。

### 名前の主語を補う是正

`/applications` を `/application-requests` にする。テーブルの改名に合わせる。配下の `inbox`、`me`、`admin`、`workflow-repairs`、`:id/approve`、`:id/reject`、`:id/resubmit`、`:id/reassign-workflow-step` はそのまま従属させる。

`/decisions` を `/decision-records` にする。

`/documents` を `/document-ledger-entries` にする。

`/skills` を `/skill-definitions` にする。本人の保有は `/skill-definitions/me` ではなく `/employee-skills/me` に置く。定義の原簿と保有実績を URL でも分ける。

`/grades` を `/grade-definitions` にする。`/grades/assignments` は `/employee-grades` へ移す。

`/positions` を `/position-definitions` にする。`/recruitment/positions` は `/job-openings` にする。両者は語を共有しない別リソースとなる。

`/certifications` を `/certification-definitions` にする。`/employee-certifications` は変更しない。

`/budgets` を `/department-budgets` にする。

`/goals` を `/performance-goals` にする。`/goals/tree` は `/performance-goals/tree` とする。

`/licenses` を `/software-licenses` にする。

`/contracts` を `/partner-contracts` にする。

`/thanks` を `/thanks-messages` にする。配下の `/thanks/balance/me` を `/thanks-point-budgets/me`、`/thanks/budget/me` を `/thanks-point-budgets/me` に統合する。現行は残高と予算が別経路だが同一の表を読むため一本化する。`/thanks/rewards` を `/thanks-rewards`、`/thanks/redemptions` を `/thanks-redemptions` にする。

`/minutes` を `/meeting-minutes-records` にする。`/meetings/:code/minutes` は会議体配下の一覧として維持する。

`/calendar` を `/company-calendar-days` にする。現行の `/calendar/days` の二階層を潰す。

`/work-styles` を `/employee-work-styles` にする。主語を補う。

`/audit-events` は変更しない。テーブル名を URL 側へ揃える。

`/permissions` を `/permission-definitions` にする。

`/onboarding` は配下を分割する。`/onboarding/templates` を `/onboarding-templates`、`/onboarding/assignments` を `/onboarding-assignments`、`/onboarding/tasks` を `/onboarding-tasks` にする。`/onboarding/me` は `/onboarding-assignments/me`、`/onboarding/employee/:code` は `/onboarding-assignments/employees/:employee_code` にする。

`/training` を分割する。`/training/courses` を `/training-courses`、`/training/enrollments` を `/training-enrollments` にする。

`/recruitment` を分割する。`/recruitment/positions` を `/job-openings`、`/recruitment/candidates` を `/recruitment-candidates` にする。候補者の一覧は `/job-openings/:job_opening_id/candidates` として募集枠配下にも置く。

`/rentals` を `/rental-reservations` にする。実体は予約であり、貸出と返却はその状態遷移である。

`/oneonones` を `/one-on-ones` にする。テーブル名 `one_on_ones` と綴りを揃える。

`/thanks-point-budgets/me/balance` を `/thanks-point-balances/me` にする。受領残高は当月原資の一部ではなく別概念であり、原資配下へ入れ子にすると原資の集約に属すると読めてしまう。第一セグメントを分けて別リソースとして表す。

### 変更しないもの

`/employees`、`/directory/employees`、`/accounts`、`/roles`、`/notifications`、`/announcements`、`/regulations`、`/partners`、`/assets`、`/stocktakes`、`/rooms`、`/surveys`、`/expenses`、`/resignations`、`/business-trips`、`/life-events`、`/family-care-leaves`、`/certificate-requests`、`/antisocial-checks`、`/commendations`、`/disciplinary-actions`、`/headcount-plans`、`/health-checkups`、`/work-accidents`、`/it-incidents`、`/employee-events`、`/employee-certifications`、`/salary-revisions`、`/review-cycles`、`/review-forms`、`/application-templates`、`/approval-delegations`、`/personnel-actions`、`/personnel-action-requests`、`/meetings`、`/audit-event-exports`、`/provisioning/identities`、`/me`、`/inbox`、`/dashboard`、`/auth`、`/batch`、`/bootstrap`。

`/me`、`/inbox`、`/dashboard`、`/auth`、`/batch`、`/bootstrap` はリソースの集合ではなく視点または操作の入口である。複数形化の対象としない。

`/directory/employees` は `/employees` と権限が異なる公開名簿であり、別リソースとして維持する。

## CLI コマンド

CLI の第一セグメントを URL のリソース名と一致させる。単数形と略称を廃し、同一資源の重複登録を解消する。

### 単数形の是正

`employee` を `employees`、`asset` を `assets`、`expense` を `expenses`、`goal` を `performance-goals`、`skill` を `skill-definitions`、`room` を `rooms`、`rental` を `rental-reservations`、`shift` を `shift-patterns` および `shift-assignments` および `shift-swap-requests`、`leave` を `leave-requests`、`review` を `review-cycles` および `review-forms`、`training` を `training-courses` および `training-enrollments`、`org` を `departments`、`career` を `career-postings` および `career-applications` および `career-sheets`、`ringi` を `ringi-requests`、`budget` を `department-budgets`、`stocktake` を `stocktakes`、`survey` を `surveys`、`resignation` を `resignations`、`business-trip` を `business-trips`、`life-event` を `life-events`、`family-care-leave` を `family-care-leaves`、`certificate-request` を `certificate-requests`、`antisocial-check` を `antisocial-checks`、`personnel-action` を `personnel-actions` にする。

`thanks` を `thanks-messages` にする。配下の `reward-add` と `rewards` は `thanks-rewards`、`redeem` と `redemptions` は `thanks-redemptions` へ移す。

`recruitment` を分割する。`recruitment/positions` と `recruitment/position-create` と `recruitment/position-update` を `job-openings` へ、`recruitment/candidates` と `recruitment/candidate-add` と `recruitment/advance` を `recruitment-candidates` へ移す。

### 略称と別名の是正

`1on1` を `one-on-ones` にする。`kb` を `knowledge-articles` にする。`notify` を `notifications` にする。`app` を `application-requests` にする。`dashboard` は変更しない。

略称は CLI 固有の語彙を生み、URL とテーブルの名前空間から乖離する。三面で同一の語を使う。

### 重複登録の解消

`room` と `rooms` の二系統を `rooms` に統合する。現行は予約側が `room`、原簿側が `rooms` に分かれている。予約は `room-reservations` として独立させる。

`app` と `application` の二系統を `application-requests` に統合する。現行の `application/mine`、`application/show`、`application/update`、`application/withdraw` は `app` 側の同名コマンドと重複する。

`asset` 配下の `mine` と `holdings` は指す対象が異なる。`mine` を `assets/lent/me`、`holdings` を `assets/holdings` として名前で区別する。

### 変更しないもの

`accounts`、`announcements`、`certifications`、`commendations`、`contracts`、`decisions`、`disciplinary-actions`、`documents`、`employee-events`、`grades`、`headcount-plans`、`health-checkups`、`it-incidents`、`licenses`、`meetings`、`minutes`、`partners`、`positions`、`regulations`、`roles`、`salary-revisions`、`work-accidents`、`work-styles`、`governance`、`onboarding`、`calendar`、`batch`、`bootstrap`、`login`、`whoami`。

このうち `certifications`、`grades`、`positions`、`licenses`、`contracts`、`documents`、`decisions`、`minutes`、`calendar`、`work-styles`、`governance`、`onboarding` はテーブルまたは URL の改名に追随して名前が変わる。上の一覧は単複の観点で是正が不要であることのみを示す。

## 決定事項

### permissions

`permissions` は改名しない。System が汎用名を汎用の意味で所有するという優先順位の規則に合致する。`permission_definitions` にすると付与側の `role_permissions` との対称性が崩れ、対称を保つには `role_permissions` を `role_permission_grants` にする必要が生じて改名対象が広がる。定義と実績の分離は `grade_definitions` と `employee_grades` のように同名の衝突がある場合に必要であり、`permissions` にその衝突はない。

### 人事評価と研修

`review_cycles`、`review_forms`、`review_cycle_policies` は performance-review App、`training_courses` と `training_enrollments` は training App が所有する。どちらも opt-in とする。

### 申請ワークフロー

`application_requests` とワークフロー群は System が所有する。申請内容は App が所有し、System は対象 context、resource kind、resource ID、version、digest で参照する。Company は判断者の会社上の資格だけを解決する。

### 会議体と意思決定記録

`decision_records` は System の汎用 Decision record とする。Company の `CollectiveBody` と authority snapshot、governance-document App の対象参照を結合しても、判断記録の同一性は System が所有する。`meetings` と `meeting_minutes_records` は meeting App が所有する。

### 組織の三重表現の解消方向

`code` を唯一の識別子とし `departments` を廃止する。`budgets` すなわち `department_budgets` が持つ `department_id` 参照は `department_code` へ付け替える。`org_departments` と `org_memberships` が既に `code` を用いており、整数の `id` を残す理由がない。

この変更は名前ではなく模型の修正であり、本書では `departments`、`org_departments`、`org_memberships` の改名を行わない。改名はモデル修正と同時に扱う。廃止後に `org_departments` を `departments` へ改名するかは、モデル修正時に決める。

### 期間版の主語

`employment_period_versions` は現名を維持する。`employment` は雇用そのものを主語とする語として成立しており、`employee_` を重ねると冗長になる。`org_` で始まる二つに主語を補ったのは、`org_` が所属先を指す修飾語にすぎず主語が欠けていたためであり、`employment` とは事情が異なる。

### 役職と募集枠の語の衝突

`recruitment_positions` を `job_openings` とする。修飾語による区別を許容せず、語の衝突自体を消す。

### career_sheets の粒度

2026-07-28 オーナー確定。今はやらない。履歴要件が業務から出ていないためである。必要になった時点で `career_sheet_versions` を追加する。

`career_sheets` は従業員 1 名につき 1 行を上書きし、過去の記載内容を追えない。名前は複数形で妥当であり、改名は要らない。

### thanks の残高と予算

2026-07-28 実施。当月原資と受領残高を別概念として分離した。表は増やさず、責務と URL で分けた。

送れる枠である当月原資は `thanks_point_budgets` が正本であり、`/thanks-point-budgets/me` が返す。もらった点数の累積である受領残高は `thanks_messages` の受領分から確定・未決裁の交換を引いて算出し、`/thanks-point-balances/me` が返す。受領残高は `thanks_point_budgets` を一切参照しない。

受領側に表を作らない判断の理由は次のとおりである。受領残高の式は交換申請と承認の単一ステートメント防御に既に埋め込まれており、同時実行下で残高を割らせないために SQL 内で原子的に評価する必要がある。台帳表や残高列を足すとその防御と同期させる書き込み経路が増え、二重持ちによる不整合の危険を招く。分離すべきだったのは保存先ではなく責務であり、読み取りの正本を `ThanksPointBalanceRepository` に移して当月原資と分けた。

## migration の命名運用

現行は 113 件のうち 32 件が `0001` から `0032` の連番を持ち、81 件が連番を持たない機能名である。適用は `wrangler d1 migrations apply` が行い、順序はファイル名の辞書順に依存する。

連番を持たない 81 件は、数字より英字が後に並ぶため連番群の後に適用される。この配置は現時点で偶然成立している。`application_workflow_atomic.sql` は連番期に作られた `applications` を変更し、`asset_dispose.sql` は `asset.sql` が作る `assets` を変更する。いずれも依存先が辞書順で先に来るが、これは名前が偶然その順序を満たしているだけであり、規則が保証していない。新しい機能名を追加したとき、その名前が依存先より辞書順で前に来れば適用が失敗する。

命名も揺れている。連番を持たない 81 件のうち 31 件が下線を、残りが連字符を区切りに使う。

是正案は次のとおりとする。

すべての migration に 4 桁の連番を前置し、`NNNN_<内容>.sql` の形に統一する。区切りは下線に揃える。連番は追加順に採番し、欠番と重複を作らない。

既存の 81 件には、現在の辞書順で確定している適用順に従って `0033` から連番を振る。現在の順序は本番の適用済み記録と一致しているため、順序を変えずに番号だけを与える。番号を与える改名は適用済みの記録名と食い違うため、記録側の名前も同時に更新する手順を移行時に用意する。

以後の追加では、依存関係を名前ではなく連番で表す。テーブルを作る migration と、そのテーブルを変更する migration が別ファイルになる場合、後者の番号を必ず大きくする。

連番だけでは内容が読めないため、内容部分には対象と操作を書く。`0033_assets_add_disposal_columns.sql` のように、対象のテーブルと操作を含める。既存の `asset_dispose.sql` のような操作名のみの命名は避ける。
