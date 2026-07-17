---
id: policy.information-security
title: 情報セキュリティ規程テンプレート
kind: policy
version: 0.2.0-draft
classification: internal
owner_capability: information-security
steward_org_role: ciso
effective_from: null
effective_to: null
review_due_on: null
audience:
  all_employees: true
publication:
  mode: approval
  approver_org_roles: [board]
acknowledgement:
  required: true
  renew_on_change: true
tags: [security, asset, access, compliance]
references:
  - kind: procedure
    code: procedure.access-lifecycle
  - kind: procedure
    code: procedure.security-incident-response
procedure: null
authority_rules: []
controls:
  - key: access-lifecycle
    owner_org_role: ciso
    trigger: event
    cadence: null
    evidence: アクセス変更案件と実行証跡
    procedure: procedure.access-lifecycle
  - key: security-incident-response
    owner_org_role: ciso
    trigger: event
    cadence: null
    evidence: インシデント案件と事後確認記録
    procedure: procedure.security-incident-response
---

# 情報セキュリティ規程テンプレート

自社は資産、脅威、法域、契約、外部委託、運用体制を評価し、責任者と専門家の review を経て別版を施行する。施行までは規程または認可根拠として使用しない。

## 目的

情報と情報処理資産について、機密性、完全性、可用性、真正性、追跡可能性を必要な水準で保ち、事業と人の権利への影響を管理する。

## 適用対象

自社の役員、従業員、AgentPrincipal、ServicePrincipal、ConnectorPrincipal、委託先、外部製品を含む。適用対象と責任は Principal kind、契約、組織関係ごとに定める。

AI や service を人間の account として扱わない。各 Principal に最小権限、目的、対象、期間を与え、requester と executor を分けて記録する。

## 責任

- 経営責任者は、risk appetite、資源、重大例外を決定する。
- [[org-role:ciso]] は security program、risk、incident response を統括する。
- [[org-role:department-manager]] は担当領域の asset owner と access review を明確にする。
- 利用者と AgentPrincipal は、許可された目的、field、手段だけで情報を扱う。
- [[org-role:internal-auditor]] は統制の設計と実施結果を独立に確認する。

一人役職と合議体を現行 `org-role` 一種類で代用しない。合議が必要な decision は定足数を持つ CollectiveDecision として実装する。

## 情報分類

機密度とデータカテゴリを別軸にする。

- `public`: 公開を意図した情報
- `internal`: 組織内の通常業務へ限定する情報
- `confidential`: 漏えいや改変の影響が大きく、職務上必要な主体へ限定する情報
- `restricted`: 重大な影響を持ち、個別許可、強い認証、厳格な export 制御を要する情報

データカテゴリには directory、hr-sensitive、health、financial、authentication、legal、audit などを使う。ClassificationLevel だけで閲覧権限を決めず、DataCategory、purpose、scope、field policy を組み合わせる。

## Asset と risk

- 情報、system、device、credential、外部 integration、model、dataset、backup を asset として識別する。
- owner、custodian、classification、data category、location、dependency、retention を記録する。
- threat、vulnerability、likelihood、impact、existing control、residual risk を版付きで評価する。
- risk acceptance は権限を持つ人間の Decision とし、AI が単独で確定しない。

## Access

- Principal ごとに一意の identity を使い、credential を共有しない。
- permission、scope、field、purpose、time、state を最小権限で評価する。
- privileged operation は必要な step-up、職務分離、HumanAttestation を要求する。
- join、transfer、leave、role change、connector change を access lifecycle event として扱う。
- assignment の取消後も過去の decision と access 根拠を再構成できるようにする。

具体的な手順は [[procedure:procedure.access-lifecycle]] を参照する。

## 開発と変更

- input validation、output encoding、secret management、dependency review、security test を change lifecycle へ組み込む。
- AI が生成した変更も人間作成の変更と同じ test、review、provenance を通す。
- policy、permission、connector mapping、audit retention の変更は高リスク operation とする。
- 承認対象の digest と deployment artifact の digest を結び、承認後の改変を拒否する。

## 外部連携

- 外部へ送る field と purpose を contract で限定する。
- connector secret は専用境界が保持し、AI、client、log へ渡さない。
- 外部 result は source 付き Assertion として受領する。
- signature、replay、schema、tenant、unit、time を検証する。
- outage、duplicate、partial failure、reconciliation の手順を持つ。

## Incident

security event と incident を区別し、報告、triage、containment、investigation、recovery、post review を記録する。証拠保全、個人情報、法的通知、外部連絡は権限を持つ人間と外部専門家へ escalation する。

具体的な手順は [[procedure:procedure.security-incident-response]] を参照する。

## Record と review

保持期間、review cadence、教育頻度をこの公開テンプレートへ固定しない。asset risk、法域、契約、記録カテゴリ、legal hold を入力に、自社の公開済み policy で定める。

front matter の `controls` は ControlDefinition の宣言であり、ControlRun の実施証明ではない。control owner、対象、evidence、case mapping、適合 test が揃って初めて実施済みとみなす。
