# 機能区分

すべての能力は System、Company、App、外部連携のいずれか一つが所有する。所有区分と既定の有効状態を同じ軸にしない。

コードは `api/src/contexts/<context>/` 直下へすべてのコンテキストを対等に置く。`system` と `company` 以外の製品内コンテキストは削除可能な App であり、`apps/` という親ディレクトリは作らない。

## System

会社や業務の語彙から独立し、すべてのコンテキストが利用する停止不能な基盤。

- Principal、Account、Identity、認証、session、失効
- technical permission、role、policy、scope、field policy、職務分離
- procedure definition、case、task、proposal、decision、human attestation
- delegation、approval、rejection、差戻し、取消、execution authorization
- audit、evidence、attachment metadata、版、来歴、訂正、保持、開示制御
- notification、scheduler、batch、job、idempotency、outbox、inbox、retry
- API、webhook、import、export、connector、external assertion、reconciliation
- 設定、機能有効化、health、migration safety、運用診断

System は Employee、Department、LegalEntity、経費、勤怠などの会社・業務語彙を保存しない。専用業務の対象は所有コンテキスト、resource kind、resource ID、版、digest の変更不能な参照として扱う。特定業務の正本を必要としない汎用手続きは、System の版付き Proposal body として扱う。

## Company

一つの deployment で運営する会社の正本。停止すると製品が会社の主体、組織、責任を判断できなくなる。

- LegalEntity、会社 profile、法域、locale、timezone、通貨、会計年度
- 事業所、勤務場所、法人、拠点、組織単位の識別
- Person、Employee、Employment、在籍状態、有効期間
- OrgUnit、Department、Membership、ReportingRelation
- Job、Position、Grade、OrganizationalOffice、期間付き割当
- ResponsibilityAssignment、OrganizationalAuthority、CollectiveBody
- System Account と Employee の対応
- 入社、異動、休職、復職、退職、再入社の雇用事実と人事発令
- System の汎用判断へ会社上の資格と責任主体を提供する解決処理

Company は汎用の申請、承認、通知、監査、batch を再実装しない。規程文書、採用、onboarding、勤怠、経費など、会社が無くても会社の同一性が保たれる機能は Company に含めない。

## Apps

業務目的と業務上の不変条件を所有し、削除または無効化できるコンテキスト。App は System と Company だけを利用でき、他の App を直接 import しない。

template に基づく汎用的な社内手続きは System が所有するため、`request` App は設けない。個別 App は自分の業務提案と実行規則を所有し、System workflow へ接続する。

既定で有効にできる App は attendance、leave、family-care-leave、shift、company-calendar、expense、business-trip、budget、ringi、asset、stocktake、room、rental、software-license、partner、contract、antisocial-check、recruitment、headcount-plan、health-checkup、work-accident、certification、commendation、disciplinary-action、meeting、life-event、work-style とする。

既定で無効にできる App は announcement、knowledge、regulation、governance-document、onboarding、offboarding、certificate-request、goal、performance-review、skill、training、career、one-on-one、survey、thanks、it-incident、compensation-change とする。

既定の有効状態は導入時の利便性であり、価値や依存階層を表さない。既定で有効な App も無効化と削除ができなければならない。

dashboard、inbox、directory、search は複数コンテキストの read model または UI composition とする。業務事実の正本を所有せず、独立 App として扱わない。複数 context を集約する HTTP route は API composition root に置く。

## 外部連携

会社運営に必要でも、誤りが金銭損害、法令違反、権利侵害へ直結し、専門製品または専門家が最終責任を持つ能力は製品内に実装しない。

- 総勘定元帳、仕訳、決算、財務諸表、税額計算、税務申告
- 給与、賞与、源泉徴収、社会保険料、年末調整の計算
- 送金、決済、清算、銀行残高、法人カード取引の実行
- 法令適合性、契約解釈、届出義務、電子署名の法的効力の最終判断
- 本人確認、信用、制裁、反社会的勢力の最終判断
- 医療判断、労働安全衛生、労務適否の専門判断
- 販売、CRM、受注、顧客提供、在庫、製造、物流

製品は必要に応じて入力事実、依頼、社内判断、承認済み指示、外部への引渡し、出所付き外部結果、採否、照合、期限、証拠を保持する。外部成功を内部承認で代用せず、通信停止を成功として扱わない。

## 判定基準

次の順で所有先を決める。

- 会社や業務を知らずに同じ不変条件を適用できるなら System
- 会社、従業員、雇用、組織、責任、権限の正本なら Company
- 無効化しても会社の同一性と System の安全性が保たれるなら App
- 専門的な最終計算、最終判断、資金移動、事業固有の実行なら外部連携

同じ能力を複数の所有先へ分割しない。App の業務 record は App、汎用 case と decision は System、判断者の会社上の資格は Company が所有し、参照と snapshot で接続する。

## 有効化

System と Company は常に有効とする。App は `default` または `opt-in` の有効化設定を持ち、無効な App の route は認証より前に 404 で拒否する。Web は API が返す有効化状態に従い、無効な App の導線を表示しない。

現行実装は互換のため `ENABLED_OPTIONAL_FEATURES` と `DISABLED_STANDARD_FEATURES` という旧名を使用する。前者は opt-in App、後者は default App の有効状態を制御する。変数名は所有境界を表さず、App context の分離後に置換する。

## 完成条件

App は domain、application、infrastructure、interface のうち必要な層を持ち、対象、状態、遷移、認可、失敗、競合、訂正、監査、テストが揃うまで route registry へ登録しない。schema だけ、画面だけ、任意 JSON だけの実装を有効な App として扱わない。

App を削除するときは対象 context のディレクトリ、route module 登録、所有 migration、seed、有効化 metadata、利用側の導線だけを削除する。他の App の変更を必要とする依存は追加しない。

## 現行実装差分

現在の汎用手続きは System の ProcedureDefinition、Proposal、Case、Task、HumanAttestation、Delegation、ExecutionAuthorization を正本とする。既存の application request HTTP 契約は API composition が System と Company の資格解決へ接続し、独立した `request` コンテキストと旧 runtime table は削除済みである。

独立させるべき App 実装はなお `api/src/contexts/company` に同居している。`/inbox/counts` は System 手続きと複数業務の read model なので、どの context の正本にもせず `api/src/api/routes` が合成する。

受信箱の集約タブは App の無効化に完全には追従しない。無効な App の tab が残る場合も API は 404 で拒否するが、分離完了条件は UI の導線も有効化状態へ追従することである。
