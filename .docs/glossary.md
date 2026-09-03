# 用語

英語の model 名はコードと domain で同じ意味を保持する。画面表示の翻訳は許可するが、型の同一性、関係、不変条件を変更しない。

## メタモデル

### Kind

対象の同一性を与える本質的な型。Person、Organization、BookCopy、ParkingSpace など。

### Role

関係または文脈によって一時的に担う型。Employee、Applicant、Approver、ReservableResource など。Role が変わっても元の対象の同一性は変わらない。

### Phase

ライフサイクル状態によって一時的に属する型。Active、OnLeave、Retired など。

### Relator

複数の当事者を特定の意味で結ぶ関係の実体。Employment、Membership、Reservation、Loan、Delegation など。有効期間、根拠、状態、来歴を持つ。

### Endurant

時間を通じて同一性を保つ対象。人、組織、資源、文書など。

### Occurrence

ある期間に起きる出来事または過程。申請、移動、会議、実行など。

### Situation

ある時点または期間に成立する状態。

### InformationObject

内容と版を持ち、複製可能な情報。規程、申請内容、提案、外部結果、証拠など。

### 会社共通核

複数 domain で同じ意味と不変条件を持つ、主体、時間、権限、手続き、資源、記録、来歴などの理論。詳細は [会社メタモデル](./company-model.md) を参照する。

### Domain extension

特定 domain の Kind、Role、Relator、項目、不変条件を追加する型付き拡張。schema namespace、version、validator、migration を持つ。

### 能力質問

model から答えられなければならない具体的な問い。拡張の意味と完全性を反例とともに検査する。

### 保守的拡張

新しい概念と公理を追加しても、既存語彙だけで述べられる従来の結論を意図せず変えない拡張。

### 可換図式

同じ始点と終点を持つ複数の変換経路が、同じ意味と結果になることを表す図式。Web、CLI、AI の経路一致や、承認 payload と実行 payload の一致を検査する。

## 主体と組織

### Party

法的または業務上の当事者になれる Person または Organization。

### Person

自然人。Employee や Approver は Person が文脈で担う Role である。

### Organization

法人、社内組織、外部機関など、組織として識別する対象。

### LegalEntity

法域の下で権利義務の主体となる Organization。外部の法人も LegalEntity として参照できる。

### OrgUnit

部署、部門、team などの組織単位。

### OrganizationalOffice

一人が有効期間付きで就く責任ある役職。

### CollectiveBody

構成員、定足数、議決方式、Resolution を持つ合議体。単一の role approval と同一ではない。

### Membership

Party が Organization、OrgUnit、CollectiveBody に属する期間付き関係。

### OfficeAssignment

Person と OrganizationalOffice を結ぶ就任関係。

### ReportingRelation

上司、部下、責任者を結ぶ期間付き関係。現在関係と過去 snapshot を区別する。

### ResponsibilityRole

組織、案件、能力または資源に対して期待する成果と継続責任を表す Role。

### ResponsibilityAssignment

ResponsibilityRole と対象範囲を OrganizationalOffice または CollectiveBody へ割り当てる期間付き関係。承認者と同一とは限らない。

### Project

有限の目的、責任主体、期間、状態を持つ事業上の取組。OrgUnit と同一ではない。

### CostCenter

費用の計画、帰属、責任範囲を識別する期間付き管理単位。法人、OrgUnit、外部会計 ID と同一ではない。

### Principal

システムが認証し、操作主体として識別する対象。HumanPrincipal、AgentPrincipal、ServicePrincipal、ConnectorPrincipal を含む。

### Account

Principal の認証状態、session 失効、credential 関係を管理する技術的対象。Person や Employee と同一ではない。

### Identity

Principal を認証する credential または外部識別子。

### HumanPrincipal

人間本人として認証された Principal。HumanAttestation を作成できる唯一の Principal kind。

### AgentPrincipal

AI エージェントとして認証された Principal。提案と限定実行はできるが、人間本人の承認を生成できない。

### ServicePrincipal

内部 service または batch の Principal。

### ConnectorPrincipal

外部 API credential を使用する専用 Principal。

## 権限と認可

### TechnicalPermission

API operation を呼び出せる技術的能力。会社上の決裁権限を意味しない。

### SystemRole

TechnicalPermission の束。組織上の責任 role と分ける。

### OrganizationalAuthority

会社として特定種類の Decision を行える制度上の権限。API を呼ぶ TechnicalPermission を自動的に与えない。

### CaseAssignment

特定 case、step、round に限って担当または候補者となる関係。

### Scope

permission を適用できる対象集合。self、participant、assigned case、org unit、subtree、organization など。

### FieldPolicy

Principal、purpose、DataCategory、ClassificationLevel に応じ、許可する field と operation を定める policy。

### ClassificationLevel

公開範囲と影響度の軸。public、internal、confidential、restricted。

### DataCategory

情報の意味カテゴリ。directory、hr-sensitive、health、financial、authentication、legal、audit など。機密度と別軸である。

### HumanAttestation

HumanPrincipal が、固定された proposal digest、効果、対象、期限を確認した記録。login 済み、既読、AI の説明とは同義でない。

### ExternalApprovalChannel

固定された Proposal を外部 messaging 製品などへ表示し、人間の入力を API へ戻す提供面。認可境界または HumanAttestation の正本ではない。

### ExecutionAuthorization

TechnicalPermission、OrganizationalAuthority、CaseAssignment、状態、scope、必要な attestation を合成した、対象限定で短命な実行許可。

### TaskProxy

特定 case task の操作だけを代理する関係。

### AuthorityDelegation

会社上の決裁権限の限定された一部を移す関係。

### ActingAssignment

不在時に OrganizationalOffice を一時代行する関係。

### ExecutionMandate

人間または組織が AgentPrincipal や ServicePrincipal へ、目的、操作、対象、期間を限定して実行を委ねる関係。

### BreakGlassAccessGrant

障害対応などのため、短期間だけ技術 access を付与する関係。EmergencyBusinessDecision と別である。

## 手続きと判断

### Capability

組織が継続的に達成できる必要がある成果。部署、画面、process、system から独立して識別する。

### ProcedureDefinition

手順、分岐、担当、期限、完了条件を持つ版付き定義。

### ProcedureCase

ProcedureDefinition の特定版から開始した実行案件。

### Task

Case 内で担当、期限、状態、完了条件を持つ作業。

### Proposal

実行前に対象、parameter、差分、効果、revision、期限を固定した変更案。

### DecisionAct

権限を持つ主体が判断した出来事。

### DecisionContent

判断対象、条件、理由、参照資料を表す情報。

### DecisionOutcome

承認、却下、差戻し、棄権などの判断結果。

### CollectiveDecision

合議体の構成員、定足数、議決方式から成立する Decision。

### EmergencyBusinessDecision

通常の決裁経路を待てない条件で行う専用の会社判断。自己承認の例外として扱わず、PostReview を発生させる。

### ControlDefinition

特定 risk を下げる統制の定義。

### ControlRun

ControlDefinition を特定時点、対象について実施した記録。

## 記録と時間

### Event

現実または system で起きた出来事。Record と同一ではない。

### Observation

主体が方法を伴って観測した内容。

### Assertion

主体または system が真であると述べた命題。事実と自動的に同一ではない。

### Assessment

専門家、外部製品、AI などによる評価または算出結果。

### AcceptanceStatus

Assertion を未検証、採用、却下、係争中、訂正済みのどれとして扱うか。

### Evidence

Assertion または Decision を支持、反証する情報。

### Record

Event、Assertion、Decision、Evidence などを保持する版付き InformationObject。

### Provenance

情報の生成、利用、変換、派生、責任主体の連鎖。

### ValidTime

現実世界で関係または状態が成立する時間。

### RecordedTime

system がその record を保持し、知っていた時間。

### PolicyTime

根拠となる policy version が施行中だった時間。

### MetricDefinition

事業指標の入力、dimension、計算、単位、時間解釈、認可、版を定める InformationObject。

### MetricObservation

MetricDefinition の特定版と入力 snapshot から計算した、時点または期間付きの値。入力参照、as-of、計算時点、provenance を持つ。

## 資源

### Resource

Endurant または QuantityPool が、組織の目的に利用可能な対象として担う RoleMixin。Resource は identity を与える上位 Kind ではない。MeetingRoom、ParkingSpace、BookCopy などが固有の Kind を保ったまま Resource role を担う。

### ResourceRecord

Resource role の担い手、管理 ID、owner、classification を記録する InformationObject。

### ResourceCapability

資源が提供できる予約、貸出、消費、割当、共有などの能力。

### Reservation

主体、ResourceCapability、時間枠、数量、優先規則を結ぶ関係。単なる利用申出と区別する。

### Allocation

資源能力または数量を主体へ割り当てる関係。

### Loan

貸出者、借受者、資源個体、期間、返却状態を結ぶ関係。

### Custody

資源の保管責任を結ぶ関係。

## 約束、金銭、外部実現

### Commitment

将来の行為、引渡し、支払に関する約束。

### Obligation

規範または Commitment から生じる義務。

### Entitlement

受け取る、利用する、要求する権利。

### MonetaryAmount

currency を伴う金額。会計残高や支払完了を意味しない。

### BudgetEnvelope

目的、期間、責任範囲を持つ上限または計画。総勘定元帳と同一ではない。

### PaymentProposal

支払を行う前の具体的提案。

### PaymentInstruction

権限ある Decision を経て、外部実行主体へ渡す指示。

### SettlementAssertion

外部主体が清算済みと述べた source 付き Assertion。

### ExternalDeterminationRequest

外部専門家または製品へ評価または計算を依頼する不変記録。目的、対象、法域、入力 digest、要求時点、依頼先を持つ。

### ExternalAssessment

外部専門家または製品が判断として作成した Assessment。request、source、資格または契約、rule または model version、実施時点、受領時点、採否を持つ。

### ExternalComputation

外部専門家または製品が計算として作成した Assessment。request、source、資格または契約、rule または model version、実施時点、受領時点、採否、単位を持つ。

### ConnectorContract

外部連携の source of truth、direction、ID、schema、mapping、security、retry、reconciliation を定める版付き契約。

### Outbox

内部 transaction とともに確定し、外部送信を再試行可能にする message record。

### Inbox

外部 message を検証、永続化、重複排除してから domain へ渡す境界。

### Reconciliation

内部 record と外部 Assertion を比較し、採用、係争、訂正を決める過程。

## 実装状態

### 実装済み

利用者が現在の API または提供面から主要な業務を完結できる状態。将来モデルの全不変条件を実装済みという意味ではない。

### 部分実装

主要要素の一部は利用できるが、提供面、状態遷移、認可、外部接続、履歴などに不足がある状態。

### 台帳のみ

schema はあるが、利用者が業務を完結する API、Web、CLI がない状態。

### 未実装

会社モデルには存在するが、現在の製品能力として提供しない状態。

### 非対象

open-bedrock が最終実行を所有しない状態。会社モデルから除外されたという意味ではなく、外部実現と調整記録を持てる場合がある。
