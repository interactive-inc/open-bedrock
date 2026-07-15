---
id: procedure.security-incident-response
title: 情報セキュリティ incident 対応手続きテンプレート
kind: procedure
version: 1.1.0-draft
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
  approver_org_roles: [ciso]
acknowledgement:
  required: false
tags: [security, incident, evidence]
references:
  - kind: policy
    code: policy.information-security
procedure:
  execution: sequence
  steps:
    - key: report
      name: 発見した event と観測事実を安全な窓口へ報告する
      kind: notification
      assignee:
        type: subject_employee
      due_days: 0
    - key: triage
      name: 影響、緊急度、data category、owner を評価する
      kind: decision
      assignee:
        type: org_role
        code: ciso
      due_days: 0
      evidence_required: true
    - key: contain
      name: 証拠を保全し被害拡大を抑える
      kind: checklist
      assignee:
        type: org_role
        code: ciso
      due_days: 0
    - key: investigate
      name: 原因、影響、actor、timeline を調査する
      kind: evidence
      assignee:
        type: org_role
        code: ciso
      due_days: 5
      evidence_required: true
    - key: recover
      name: 安全な状態へ復旧し整合性を検証する
      kind: evidence
      assignee:
        type: org_role
        code: ciso
      due_days: 10
      evidence_required: true
    - key: post-review
      name: 再発防止、残存 risk、例外を review する
      kind: decision
      assignee:
        type: org_role
        code: ciso
      due_days: 30
      evidence_required: true
authority_rules: []
controls: []
---

# 情報セキュリティ incident 対応手続きテンプレート

規範性: 未施行テンプレート。導入組織の手続きまたは実行根拠として使用しない。

この未施行テンプレートは、security event の報告、triage、containment、investigation、recovery、post review を追跡する。自動化は観測収集、隔離提案、照合を支援できるが、広範な access 変更、証拠破壊の可能性がある操作、外部通知は RiskPolicy に応じて HumanAttestation を要求する。

## 実行上の注意

- Event、Observation、Assertion、Assessment、Decision を分ける。
- incident 時刻、発見時刻、記録時刻、対応時刻を分ける。
- break-glass access は短命、対象限定とし、通常の business authority を与えない。
- AgentPrincipal は人間の account を使わず、executed_by と requested_by を残す。
- 外部 provider の status を検証なしで復旧完了へ写さない。
- evidence の秘密と個人情報を notification、log、prompt へ過剰複製しない。

## 完了条件

- timeline、影響対象、data category、source、evidence を再構成できる。
- containment と recovery の実行者、command、result が記録されている。
- 外部 system と内部状態を reconciliation している。
- 残存 risk は権限を持つ人間が Decision として受け入れるか、是正 task を持つ。
- emergency access と temporary permission が失効し、post review が完了している。
