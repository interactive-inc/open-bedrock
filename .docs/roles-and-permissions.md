# ロールと権限

実装の正は System と Company の permission key catalog、composition の metadata catalog、migrations の seed。認可の概念モデルは [認可モデル](./authorization-model.md) を参照する。

## 仕組み

- permission が認可の正。"domain:action" または "domain:action:scope" 形式の機械可読キーで、System は api/src/domain/system/iam、Company は api/src/domain/company/iam、全体の合成は api/src/composition/iam が所有する
- ロールは permission を集めた集合であり、動的に作成・編集できる(web の /system/roles、karte roles、POST /iam/roles)
- アカウントには複数ロールを割り当てられ、実効権限は全ロールの和集合
- 判定は deny-by-default(fail-closed)。未知のキーや解決失敗は常に拒否
- JWT に権限を載せない。リクエスト毎に DB から解決するため、ロール変更は即時反映される
- self(自分のデータ)は permission にせず、本人一致の判定としてコードに残す。「自分の申請を見る」のに権限は要らない
- ロール・権限の変更は audit_events に append-only で記録される
- knowledge、skill には管理 permission がなく、認証済み利用者の操作として実装されている。oneonone は作成(oneonone:create)と部署閲覧(oneonone:read:department)がある

## システムロール

member / manager / hr / root の4つ。is_system=1 で編集不可。移行互換のためのベースラインであり、新しい職能はプリセットロールか独自ロールで表現する。root は最強のシステムロールで、表示名は「システム管理者」。

- member: permission なし。自分のデータと全員公開の情報のみ
- manager: 承認と大半の管理。目標・評価・勤怠はレポートライン配下(:reports)のみで、全社は見えない
- hr: manager に加えて組織管理・従業員削除・全社横断閲覧(:all)
- root: 全権。IAM とアカウント管理を含む

## プリセットロール

migration の seed(0021_role_presets.sql と 0025_management_and_partner_permissions.sql)で投入する編集可能なロール(is_system=0)。職能ごとの最小権限の出発点で、組織に合わせて編集・複製してよい。

- 評価管理者(review_admin): 評価サイクル運営と目標評価の専任。評価の確定権限を人事から分離するための役。等級運用を正しく回す要
- 総務(general_affairs): 会議室・備品・貸与品・取引先・契約・アナウンス・規程集・カレンダー・文書台帳・反社チェック。評価・勤怠などの人事データは見えない
- 情シス(it_admin): アカウント・ロール・権限の管理、ライセンス台帳、インシデント記録。評価・勤怠などの人事データは見えない
- 監査(auditor): 全ドメインの横断閲覧のみ。承認も変更もできない。ただし健診・給与改定・懲戒は監査にも見せない(最機微)
- 経営(executive): 経営の記録(稟議・会議体・意思決定)と会社状態の俯瞰(経営ダッシュボード・全社目標・契約・予算・人員計画)。個別の人事操作は持たない

推奨の使い分け。一般従業員は member のまま、部下を持ったら manager を足す。人事部門は hr、評価の確定は review_admin だけに絞る。管理部門の担当には general_affairs、システム管理者には it_admin を与え、root は最小人数に留める。

## スコープ設計

permission の scope は4段階で、目標の閲覧・評価と勤怠の閲覧に適用済み。

- self: 本人。permission にせず所有者判定としてコードに残す
- reports: 自分のレポートライン配下。org_memberships の manager チェーンを対象従業員から上に辿り、閲覧者が現れるかで判定(直属に限らず配下全体)
- department: 自分の所属部署。org_memberships の department_code の一致で判定し、下位部署は含まない
- all: 全社

判定は次のカスケード。self → :all 保持 → 配下かつ :reports 保持 → 同部署かつ :department 保持 → 拒否。関係解決(org の走査)は他者のデータに触るときだけ実行する。

適用済みのキーは goal:read / goal:evaluate / attendance:read / leave:read / grade:read / application:read / oneonone:read の各スコープ。manager は :reports、hr・評価管理者・監査は :all を持つ。:department はプリセットに実務付与しておらず、部門人事のようなカスタムロール用(escalation guard を通すため root は保持する)。

一覧 API のスコープ絞り込みも実装済み。GET /goals・GET /attendance・GET /leave/requests・GET /applications・GET /oneonones は scope=department&department_code= で部署メンバー分を一覧する(対応する :department permission が必要)。GET /goals・GET /attendance・GET /leave/requests は scope=reports(配下全員分)や scope=all(全社)も受け付ける。

## 実装の決まりごと

- 新しいドメインを作るときは、必ず can- ヘルパー(api/src/lib 配下)を permission キーで実装し、ロール文字列で判定しない
- web の出し分けも /auth/me の permissions を使う(web/lib 配下の can- ヘルパー)。ロール名での判定は動的ロールに追従できないため禁止
- permission を追加したら所有する context の key catalog、composition の metadata catalog、migration の seed に書く。ownership test が重複と欠落を拒否し、起動時の subset チェックが DB 投影との乖離を検出する
- 機微項目は従業員台帳のカラムに追加せず、別資源のドメインに分離して権限を貼る。等級は grade ドメインの割当履歴として持ち、権限が無ければ API も画面も見えない
- 役職マスタの管理 `position:manage` は grade:manage と同じく hr と root に付与する(0028_position_master_permission.sql)。マスタ一覧の閲覧に専用 permission は設けず、全認証者が読める。役職の割当履歴は持たず、期間付き履歴は人事発令に一元化する

## 既知リスク

構造上の制約を記録する。具体的な値や現行実装は code、migration、生成型を正とする。

- D1 に外部キー制約がなく、孤児行はアプリ層の検査、index、監査で防ぐ
- permission catalog は code(SSOT)と DB 投影で二重定義になるため、起動時の subset 検査で同期ズレを検出する
- per-template の approver_roles に未知の role key が混ざる可能性があり、突合で検出する
- root の実効全許可を code に固定するため、柔軟性と硬直がトレードオフになる
- 認可解決は request ごとに account と role を join するため、レイテンシ増を許容する
- permission の OR 結合は deny を表現できないため、禁止は scope と field policy で表す
