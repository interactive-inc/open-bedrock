---
id: policy.privacy-protection
title: 個人情報保護規程テンプレート
kind: policy
version: 0.2.0-draft
classification: internal
owner_capability: privacy-protection
steward_org_role: privacy-manager
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
tags: [human, privacy, security, compliance]
references:
  - kind: procedure
    code: procedure.privacy-incident-response
procedure: null
authority_rules: []
controls:
  - key: privacy-incident-response
    owner_org_role: privacy-manager
    trigger: event
    cadence: null
    evidence: 個人情報 incident 案件と判断記録
    procedure: procedure.privacy-incident-response
---

# 個人情報保護規程テンプレート

自社は適用法令、監督機関、事業、データ主体、越境移転、委託、従業員関係を外部専門家と確認し、正式規程として別版を施行する。施行までは規程または認可根拠として使用せず、法的助言としても使用しない。

## 目的

人に関する情報を、明示した目的、適切な根拠、必要最小限の範囲、説明可能な保持期間で扱い、本人の権利と組織の義務を追跡できるようにする。

## データ inventory

個人データを含む processing activity は次を記録する。

- data subject category
- data category と ClassificationLevel
- purpose
- 根拠となる法令、契約、同意、正当な業務関係などの source 付き Assessment
- controller、processor、internal owner
- source、recipient、external connector
- jurisdiction と transfer mechanism
- retention trigger と disposition
- access scope と field policy
- automated processing と人への影響

法的根拠の最終判断を open-bedrock が自動生成しない。外部専門家の見解を source、rule version、review date 付き Assessment として記録する。

## 取得と利用

- purpose を特定し、必要な field だけを取得する。
- 取得 source、通知、同意または他の根拠を記録する。
- 新しい purpose への再利用は当初目的との整合性または新しい根拠を review する。
- AI の学習、prompt、tool 呼出しへ送る情報も第三者提供または委託に相当し得る外部 handoff として評価する。
- 本人が提出した情報と、外部 source や AI が推測した Assessment を区別する。

## Access と安全管理

- Human、Agent、Service、Connector を別 Principal として最小権限にする。
- hr-sensitive、health、authentication などの DataCategory へ field policy を適用する。
- list、search、export、log、backup、prompt transcript に同じ purpose と access rule を適用する。
- secret、認証情報、不要な個人データを AI context へ含めない。
- 外部委託先と connector は contract、subprocessor、location、retention、deletion、incident notification を管理する。

## Accuracy と Assertion

本人申告、観測、外部 system、専門家、AI output を source 付き Assertion として区別する。採用、係争、訂正、superseded を記録し、外部 output を無条件に確定事実へ昇格しない。

訂正では元 record を不可視に上書きせず、訂正対象、理由、requester、decider、valid time、recorded time を保持する。

## Retention と deletion

- retention を固定年数だけでなく、開始 trigger、法域、記録カテゴリ、legal hold として定義する。
- 業務不要、法的保持、契約、本人 request の衝突を decision case として扱う。
- deletion、anonymization、restriction、archive を区別する。
- employee、account、role assignment を削除しても、必要な audit と decision 根拠を無関係な個人情報を残さず再構成できる設計にする。

## 本人 request

access、correction、deletion、restriction、objection、portability など、適用法域で必要な request kind を設定する。本人確認、対象 system の探索、例外、decision、期限、回答、実行結果を case として追跡する。

open-bedrock は法的な応答義務、例外、期限を自動判定しない。法域と専門判断を入力にし、人間の Decision を記録する。

## Incident

漏えい、滅失、毀損、不正利用またはその疑いを検出したら [[procedure:procedure.privacy-incident-response]] を開始する。事実、影響、対象者、データカテゴリ、containment、evidence を記録し、監督機関や本人への通知要否と期限は外部専門家の Assessment と権限ある人間の Decision で確定する。

## External transfer

外部製品へ渡す前に、recipient、purpose、field、jurisdiction、contract、security、retention を確認する。outbound payload と承認対象の digest を結び、connector が許可 field を超えて送信できないようにする。

外部から返る結果は Assertion として取り込み、source、対象、時点、mapping version を保持する。

## Record と review

training、audit、policy review の cadence を公開テンプレートへ固定しない。risk と法域に基づき自社が定める。front matter の control 宣言だけを実施証明にせず、ControlRun と evidence を別に記録する。
