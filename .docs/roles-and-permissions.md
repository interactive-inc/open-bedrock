# ロールと権限

認可の仕組みと、ロールの設計方針をまとめる。実装の正はコード(api/src/lib/auth/permission-keys.ts と migrations の seed)。認証を含む設計全体は [[iam-auth-design|IAM 認証・認可システム設計]] を参照。

## 仕組み

- permission が認可の正。"domain:action" または "domain:action:scope" 形式の機械可読キーで、カタログはコードの permission-keys.ts が SSOT
- ロールは permission を集めた集合であり、動的に作成・編集できる(web の /admin/roles、karte roles、POST /iam/roles)
- アカウントには複数ロールを割り当てられ、実効権限は全ロールの和集合
- 判定は deny-by-default(fail-closed)。未知のキーや解決失敗は常に拒否
- JWT に権限を載せない。リクエスト毎に DB から解決するため、ロール変更は即時反映される
- self(自分のデータ)は permission にせず、本人一致の判定としてコードに残す。「自分の申請を見る」のに権限は要らない
- ロール・権限の変更は audit_logs に append-only で記録される

## システムロール

member / manager / hr / admin の4つ。is_system=1 で編集不可。移行互換のためのベースラインであり、新しい職能はプリセットロールか独自ロールで表現する。

- member: permission なし。自分のデータと全員公開の情報のみ
- manager: 承認と大半の管理。目標・評価・勤怠はレポートライン配下(:reports)のみで、全社は見えない
- hr: manager に加えて組織管理・従業員削除・全社横断閲覧(:all)
- admin: 全権。IAM とアカウント管理を含む

## プリセットロール

migration(0009_role_presets.sql)で投入する編集可能なロール(is_system=0)。職能ごとの最小権限の出発点で、組織に合わせて編集・複製してよい。

- 評価管理者(review_admin): 評価サイクル運営と目標評価の専任。評価の確定権限を人事から分離するための役。等級運用を正しく回す要
- 総務(general_affairs): 会議室・備品・貸与品予約の横断閲覧・通知・反社チェック。評価・勤怠などの人事データは見えない
- 情シス(it_admin): アカウント・ロール・権限の管理と従業員アカウントの払い出しのみ。評価・勤怠などの人事データは見えない
- 監査(auditor): 全ドメインの横断閲覧のみ。承認も変更もできない

推奨の使い分け。一般従業員は member のまま、部下を持ったら manager を足す。人事部門は hr、評価の確定は review_admin だけに絞る。管理部門の担当には general_affairs、システム管理者には it_admin を与え、admin は最小人数に留める。

## スコープ設計(第1弾実装済み)

permission の scope は4段階で、目標の閲覧・評価と勤怠の閲覧に適用済み。

- self: 本人。permission にせず所有者判定としてコードに残す
- reports: 自分のレポートライン配下。org_memberships の manager チェーンを対象従業員から上に辿り、閲覧者が現れるかで判定(直属に限らず配下全体)
- department: 自分の所属部署。org_memberships の department_code の一致で判定
- all: 全社

判定は次のカスケード。self → :all 保持 → 配下かつ :reports 保持 → 同部署かつ :department 保持 → 拒否。関係解決(org の走査)は他者のデータに触るときだけ実行する。

適用済みのキーは goal:read:{all,reports,department} / goal:evaluate と goal:evaluate:reports / attendance:read:{all,reports,department}。manager は :reports、hr・評価管理者・監査は :all を持つ。:department はプリセットに実務付与しておらず、部門人事のようなカスタムロール用(escalation guard を通すため admin は保持する)。

残り: 休暇など他の機微ドメインへの適用、一覧 API のスコープ絞り込み(「配下全員の目標を一覧で」)、部署の階層(下位部署を含めるか)の扱い。

## ギャップ(次にやること)

- スコープの拡大。第1弾(目標・評価・勤怠)は済み。休暇などへの適用と、一覧 API のスコープ絞り込みが残る
- フィールドレベルの出し分け。従業員台帳に等級・評価系フィールドを載せる前に、閲覧権限による項目の伏せ込みが必要
- 労務系ドメイン(証明書発行・退職・産休育休介護・ライフイベント・出張・貸与品)の横断閲覧(read:all)は実装済み。申出の状態を人事が代理で進める操作 permission が残っている
- knowledge / skill / oneonone に管理 permission が無い

## 実装の決まりごと

- 新しいドメインを作るときは、必ず can- ヘルパー(api/src/lib 配下)を permission キーで実装し、ロール文字列で判定しない
- web の出し分けも /auth/me の permissions を使う(web/lib 配下の can- ヘルパー)。ロール名での判定は動的ロールに追従できないため禁止
- permission を追加したら permission-keys.ts と migration の seed の両方に書く(起動時に subset チェックで乖離を検出)
