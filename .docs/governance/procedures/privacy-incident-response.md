---
id: procedure.privacy-incident-response
title: 個人情報 incident 対応手続きテンプレート
kind: procedure
version: 1.1.0-draft
classification: confidential
owner_capability: privacy-protection
steward_org_role: privacy-manager
effective_from: null
effective_to: null
review_due_on: null
audience:
  all_employees: false
  org_roles: [privacy-manager, privacy-auditor]
publication:
  mode: approval
  approver_org_roles: [privacy-manager]
acknowledgement:
  required: false
tags: [privacy, incident, evidence]
references:
  - kind: policy
    code: policy.privacy-protection
procedure:
  execution: sequence
  steps:
    - key: report
      name: 発見した事実又は疑いを安全な窓口へ報告する
      kind: notification
      assignee:
        type: subject_employee
      due_days: 0
    - key: protect
      name: 証拠を保全し二次被害を抑える
      kind: checklist
      assignee:
        type: org_role
        code: privacy-manager
      due_days: 0
    - key: investigate
      name: source、範囲、data category、影響を調査する
      kind: evidence
      assignee:
        type: org_role
        code: privacy-manager
      due_days: 0
      evidence_required: true
    - key: external-assessment
      name: 法域、通知義務、期限について外部専門判断を得る
      kind: evidence
      assignee:
        type: org_role
        code: privacy-manager
      due_days: 0
      evidence_required: true
    - key: reporting-decision
      name: 外部報告と本人連絡の Decision を記録する
      kind: decision
      assignee:
        type: org_role
        code: privacy-manager
      due_days: 0
      evidence_required: true
    - key: recurrence
      name: 是正と再発防止の実行結果を記録する
      kind: evidence
      assignee:
        type: org_role
        code: privacy-manager
      due_days: 30
      evidence_required: true
authority_rules: []
controls: []
---

# 個人情報 incident 対応手続きテンプレート

個人データの漏えい、滅失、毀損、不正利用またはその疑いを、発見から事後 review まで追跡する。自社が承認、施行するまでは手続きまたは実行根拠として使用しない。

法的通知義務、通知先、期限、本人への説明は open-karte が自動判定しない。適用法域と事実を外部専門家へ渡し、source、rule version、performed_at を持つ ExternalAssessment として受領する。権限を持つ HumanPrincipal がその Assessment を参照して Decision を記録する。

## 実行上の注意

incident 発生時刻、発見時刻、system 記録時刻、外部通知時刻を分ける。`due_days` は実行 engine の法的期限判定ではない。外部専門判断で得た deadline を ProcedureCase の task へ設定する。

機微な evidence を通常通知、AI prompt、公開 audit へ複製しない。access、legal hold、chain of custody、第三者共有を field policy で制御する。

## 完了条件

- 事実と推測、source、時点、対象範囲を区別している。
- containment と evidence 保全が記録されている。
- 外部 Assessment と社内 Decision が別記録になっている。
- 通知、未通知、係争中の理由と authority を再構成できる。
- 是正、再発防止、残存 risk、owner、期限が追跡されている。
