"""サンプルデータ投入スクリプト。

Usage:
  python -m server.seed
"""
from __future__ import annotations

from datetime import datetime, timedelta

from .db import Base, engine, SessionLocal
from .models import (
    Department, Employee, ApplicationTemplate, Knowledge, Room,
    Skill, EmployeeSkill, Goal, Evaluation, OneOnOne,
    Survey, SurveyResponse, CareerSheet, CareerPosting, CareerApplication, BatchJob,
)
from .auth import hash_password


def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # --- 組織 ---
        hq = Department(code="HQ", name="本社")
        hr = Department(code="HR", name="人事部", parent_id=None)
        eng = Department(code="ENG", name="エンジニアリング部", parent_id=None)
        sales = Department(code="SALES", name="営業部", parent_id=None)
        fin = Department(code="FIN", name="経理部", parent_id=None)
        db.add_all([hq, hr, eng, sales, fin])
        db.flush()

        # --- 社員（役職ベース。人名は使用しない）---
        admin = Employee(code="E0001", name="システム管理者", kana="システムカンリシャ",
                         email="admin@inta.co.jp", password_hash=hash_password("admin"),
                         dept_id=hq.id, position="管理者", role="admin",
                         hired_at=datetime(2020, 4, 1))
        hr_user = Employee(code="E0010", name="人事担当", kana="ジンジタントウ",
                           email="hr@inta.co.jp", password_hash=hash_password("hr"),
                           dept_id=hr.id, position="主任", role="hr",
                           hired_at=datetime(2019, 4, 1))
        mgr = Employee(code="E0020", name="エンジニアリング部長", kana="エンジニアリングブチョウ",
                       email="manager@inta.co.jp", password_hash=hash_password("manager"),
                       dept_id=eng.id, position="部長", role="manager",
                       hired_at=datetime(2015, 4, 1))
        m1 = Employee(code="E0021", name="エンジニアA", kana="エンジニアエー",
                      email="engineer-a@inta.co.jp", password_hash=hash_password("engineer-a"),
                      dept_id=eng.id, position="エンジニア", role="member",
                      hired_at=datetime(2022, 4, 1))
        m2 = Employee(code="E0022", name="エンジニアB", kana="エンジニアビー",
                      email="engineer-b@inta.co.jp", password_hash=hash_password("engineer-b"),
                      dept_id=eng.id, position="エンジニア", role="member",
                      hired_at=datetime(2024, 4, 1))
        sales_m = Employee(code="E0030", name="営業担当", kana="エイギョウタントウ",
                           email="sales@inta.co.jp", password_hash=hash_password("sales"),
                           dept_id=sales.id, position="営業", role="member",
                           hired_at=datetime(2023, 4, 1))
        fin_m = Employee(code="E0040", name="経理担当", kana="ケイリタントウ",
                         email="finance@inta.co.jp", password_hash=hash_password("finance"),
                         dept_id=fin.id, position="経理", role="manager",
                         hired_at=datetime(2018, 4, 1))
        db.add_all([admin, hr_user, mgr, m1, m2, sales_m, fin_m])
        db.flush()
        # ライン関係: エンジニアA / B は エンジニアリング部長配下
        m1.manager_id = mgr.id
        m2.manager_id = mgr.id
        # 営業担当の上長は人事担当（例示）
        sales_m.manager_id = hr_user.id
        db.flush()

        # --- 申請テンプレート（PoCで使う5種＋数件） ---
        templates = [
            ApplicationTemplate(
                code="APP-001", name="住所変更", category="ライフイベント",
                description="転居に伴う住所変更を申請します",
                schema_json={
                    "type": "object",
                    "properties": {
                        "new_postal_code": {"type": "string", "title": "新郵便番号"},
                        "new_address": {"type": "string", "title": "新住所"},
                        "move_date": {"type": "string", "title": "転居日 (YYYY-MM-DD)"},
                        "new_commute": {"type": "string", "title": "新通勤経路"},
                    },
                    "required": ["new_address", "move_date"],
                },
                route_json=[
                    {"step": 1, "approver": "manager_of_applicant"},
                    {"step": 2, "approver": "role:hr"},
                ],
            ),
            ApplicationTemplate(
                code="APP-017", name="稟議申請", category="各種申請",
                description="費用支出の稟議を申請します",
                schema_json={
                    "type": "object",
                    "properties": {
                        "subject": {"type": "string", "title": "件名"},
                        "amount": {"type": "number", "title": "金額(円)"},
                        "purpose": {"type": "string", "title": "目的"},
                        "supplier": {"type": "string", "title": "支払先"},
                    },
                    "required": ["subject", "amount", "purpose"],
                },
                route_json=[
                    {"step": 1, "approver": "manager_of_applicant"},
                    {"step": 2, "approver": "role:hr"},
                ],
            ),
            ApplicationTemplate(
                code="APP-018", name="経費精算", category="各種申請",
                description="立替経費の精算を申請します（承認後バクラクへ自動連携・振込）",
                schema_json={
                    "type": "object",
                    "properties": {
                        "date": {"type": "string", "title": "発生日"},
                        "category": {"type": "string", "title": "勘定科目"},
                        "amount": {"type": "number", "title": "金額(円)"},
                        "memo": {"type": "string", "title": "用途"},
                        "receipt_url": {"type": "string", "title": "領収書URL（バクラクに事前アップロード）"},
                    },
                    "required": ["date", "amount", "category", "receipt_url"],
                },
                route_json=[
                    {"step": 1, "approver": "manager_of_applicant"},
                    {"step": 2, "approver": "role:hr"},
                ],
            ),
            ApplicationTemplate(
                code="APP-020", name="証明書発行", category="各種申請",
                description="在職証明書・源泉徴収票などの発行依頼",
                schema_json={
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "title": "種別(在職/源泉/退職等)"},
                        "purpose": {"type": "string", "title": "用途"},
                        "to": {"type": "string", "title": "宛先"},
                        "count": {"type": "integer", "title": "部数"},
                    },
                    "required": ["type", "purpose"],
                },
                route_json=[
                    {"step": 1, "approver": "role:hr"},
                ],
            ),
            ApplicationTemplate(
                code="APP-024", name="会議室・ブース予約", category="社内資産",
                description="会議室の利用を申請します（API: /rooms/reservations と等価）",
                schema_json={
                    "type": "object",
                    "properties": {
                        "room": {"type": "string", "title": "会議室名"},
                        "start_at": {"type": "string", "title": "開始日時"},
                        "end_at": {"type": "string", "title": "終了日時"},
                        "purpose": {"type": "string", "title": "用途"},
                    },
                    "required": ["room", "start_at", "end_at"],
                },
                route_json=[
                    {"step": 1, "approver": "role:hr"},
                ],
            ),
        ]
        db.add_all(templates)
        db.flush()

        # --- ナレッジ ---
        kbs = [
            Knowledge(category="会社全般", title="パーパス・ビジョン・バリュー",
                      body_md="# Purpose\n人と組織の可能性を解き放つ。\n\n# Vision\n働く全ての人に最良の体験を。\n\n# Values\n誠実・挑戦・対話。",
                      tags="purpose,vision,values"),
            Knowledge(category="会社全般", title="年末年始休暇・営業日カレンダー",
                      body_md="年末年始休暇は 12/29〜1/3。GWは暦通り。社内休業日カレンダーは社内ポータル参照。",
                      tags="休暇,カレンダー"),
            Knowledge(category="規程", title="就業規則（抜粋）",
                      body_md="第1章 総則\n本規則は就業に関する基本事項を定める。\n第2章 服務\n社員は誠実に職務を遂行する。\n…",
                      tags="就業規則"),
            Knowledge(category="規程", title="36協定届について",
                      body_md="時間外労働の上限は月45時間・年360時間。特別条項を超える場合は事前承認が必要。",
                      tags="36協定,残業"),
            Knowledge(category="勤怠", title="勤怠ルール（メンバー用）",
                      body_md="出退勤は Salesforce で打刻。打刻漏れは当日中に修正申請を提出。残業はマネージャー事前承認が必要。",
                      tags="勤怠,Salesforce"),
            Knowledge(category="経費", title="経費精算の進め方（バクラク連携）",
                      body_md=(
                          "立替経費は以下の流れで精算します。\n"
                          "1. バクラク経費精算アプリで領収書を撮影／アップロードし、共有URLを取得。\n"
                          "2. open-karte で APP-018（経費精算）を提出。`receipt_url` にバクラクのURLを貼付。\n"
                          "3. 上長 → 人事の二段承認後、バクラクへ自動連携され、月次の振込予定に登録されます。\n"
                          "※ 月締めは毎月20日。20日締めを過ぎた申請は翌月扱い。"
                      ),
                      tags="経費,バクラク,精算"),
            Knowledge(category="働き方ガイド", title="リモートワークガイド",
                      body_md="原則ハイブリッド（週2出社）。リモート時は始業・終業をSlackで宣言。VPN必須。",
                      tags="リモートワーク"),
            Knowledge(category="働き方ガイド", title="副業ガイド",
                      body_md="副業は事前申請（APP-011）が必要。競合・利益相反は不可。",
                      tags="副業"),
            Knowledge(category="ライフイベント", title="結婚した場合の手続き",
                      body_md="入籍後10日以内に結婚届(APP-002)を提出。姓変更・扶養追加・住所変更も合わせて申請。",
                      tags="結婚,姓変更"),
            Knowledge(category="ライフイベント", title="出産・育児",
                      body_md="出生届(APP-003)、扶養追加、産休育休(APP-008)の各申請が必要。",
                      tags="出産,育児"),
            Knowledge(category="安全衛生", title="ストレスチェック",
                      body_md="年1回、全社員対象に実施。高ストレス判定者は産業医面談を案内。",
                      tags="ストレスチェック"),
            Knowledge(category="福利厚生", title="ストックオプション(SO)",
                      body_md="付与基準は人事委員会で決定。権利行使前に法務確認が必要。",
                      tags="SO,持株"),
            Knowledge(category="セキュリティ", title="機密書類の破棄",
                      body_md="機密書類は専用シュレッダー、または鍵付き回収ボックスへ。USB等の媒体は情報セキュリティ部門に依頼。",
                      tags="機密,セキュリティ"),
        ]
        db.add_all(kbs)

        # --- 会議室 ---
        rooms = [
            Room(name="本社A会議室", location="本社3F", capacity=10),
            Room(name="本社B会議室", location="本社3F", capacity=6),
            Room(name="ブース1",     location="本社2F", capacity=2),
            Room(name="ブース2",     location="本社2F", capacity=2),
        ]
        db.add_all(rooms)

        # --- スキルマスタ ---
        skills_def = [
            ("SK-PY",   "Python",        "言語"),
            ("SK-TS",   "TypeScript",    "言語"),
            ("SK-GO",   "Go",            "言語"),
            ("SK-FAPI", "FastAPI",       "フレームワーク"),
            ("SK-REACT","React",         "フレームワーク"),
            ("SK-AWS",  "AWS",           "クラウド"),
            ("SK-PM",   "プロジェクト管理","ビジネス"),
            ("SK-EN",   "英語(Business)","語学"),
            ("SK-BOKI", "簿記2級",        "資格"),
        ]
        skill_objs = [Skill(code=c, name=n, category=cat) for c, n, cat in skills_def]
        db.add_all(skill_objs)
        db.flush()
        sk_by_code = {s.code: s for s in skill_objs}

        db.add_all([
            EmployeeSkill(employee_id=m1.id, skill_id=sk_by_code["SK-PY"].id, level=4, years=4.0),
            EmployeeSkill(employee_id=m1.id, skill_id=sk_by_code["SK-FAPI"].id, level=3, years=2.0),
            EmployeeSkill(employee_id=m1.id, skill_id=sk_by_code["SK-AWS"].id, level=3, years=2.5),
            EmployeeSkill(employee_id=m2.id, skill_id=sk_by_code["SK-TS"].id, level=4, years=3.0),
            EmployeeSkill(employee_id=m2.id, skill_id=sk_by_code["SK-REACT"].id, level=4, years=3.0),
            EmployeeSkill(employee_id=mgr.id, skill_id=sk_by_code["SK-PM"].id, level=5, years=10.0),
            EmployeeSkill(employee_id=fin_m.id, skill_id=sk_by_code["SK-BOKI"].id, level=4, years=8.0),
        ])

        # --- MBO 目標 ---
        g1 = Goal(employee_id=m1.id, period="2026H1",
                  title="APIプラットフォーム新機能リリース",
                  description="認可基盤の刷新を含むメジャーバージョンを期内にリリース",
                  kpi="リリース日: 2026/06/30, 障害ゼロ", weight=40, status="active")
        g2 = Goal(employee_id=m1.id, period="2026H1",
                  title="社内ドキュメント整備",
                  description="API利用ガイドの整備と社内勉強会",
                  kpi="勉強会2回開催, ドキュメント刷新", weight=30, status="active")
        g3 = Goal(employee_id=m2.id, period="2026H1",
                  title="フロントUI改善",
                  description="主要画面の一新", kpi="UX指標 +20%", weight=50, status="active")
        db.add_all([g1, g2, g3])
        db.flush()
        db.add(Evaluation(goal_id=g1.id, kind="self", score=70, comment="6月末リリースに向け順調",
                          evaluator_id=m1.id))

        # --- 1on1 ---
        db.add_all([
            OneOnOne(member_id=m1.id, manager_id=mgr.id,
                     held_at=datetime(2026, 5, 10, 14, 0),
                     topics="今期目標の進捗、リリーススケジュール",
                     member_note="想定よりレビュー時間がかかっている",
                     manager_note="リソース追加を検討",
                     next_action="リリース計画の見直し（5/17まで）"),
            OneOnOne(member_id=m2.id, manager_id=mgr.id,
                     held_at=datetime(2026, 5, 12, 15, 0),
                     topics="UIリニューアルの方針",
                     member_note="デザインAB案を比較中",
                     manager_note="プロトタイプ完成は5/30まで"),
        ])

        # --- アンケート ---
        survey = Survey(
            title="2026春 エンゲージメントサーベイ",
            description="四半期ごとの組織サーベイ",
            questions_json=[
                {"id": "q1", "type": "single", "title": "業務満足度",
                 "choices": ["とても低い", "低い", "普通", "高い", "とても高い"]},
                {"id": "q2", "type": "single", "title": "チームへの貢献感",
                 "choices": ["低い", "普通", "高い"]},
                {"id": "q3", "type": "text", "title": "改善してほしい点（自由記述）"},
            ],
            status="open",
        )
        db.add(survey)
        db.flush()
        db.add_all([
            SurveyResponse(survey_id=survey.id, respondent_id=m1.id,
                           answers_json={"q1": "高い", "q2": "高い", "q3": "MTGの数を減らしたい"}),
            SurveyResponse(survey_id=survey.id, respondent_id=m2.id,
                           answers_json={"q1": "普通", "q2": "普通", "q3": "ドキュメント整備が必要"}),
        ])

        # --- キャリアシート ---
        db.add(CareerSheet(
            employee_id=m1.id,
            history="2022 入社→APIチーム配属。2024 主任。",
            strengths="バックエンド設計、API設計、自動化",
            aspirations="3年以内にテックリードを目指す",
            self_pr="複雑な業務要件を素直なAPIに落とすのが得意",
        ))
        db.add(CareerSheet(
            employee_id=m2.id,
            history="2024 入社→フロントエンドチーム配属。",
            strengths="ReactとUIデザインのバランス",
            aspirations="プロダクトデザイナーを目指す",
            self_pr="ユーザーリサーチも自主的に行う",
        ))

        # --- キャリアボード(β) ---
        posting = CareerPosting(
            title="データプラットフォームチーム エンジニア募集",
            dept_id=eng.id,
            description="社内データ基盤の構築・運用",
            required_skills="Python,AWS,SQL",
            status="open",
            posted_by=hr_user.id,
        )
        db.add(posting)

        # --- バッチ実行履歴 ---
        db.add_all([
            BatchJob(name="勤怠取込(Salesforce)", status="success",
                     started_at=datetime(2026, 5, 17, 2, 0),
                     finished_at=datetime(2026, 5, 17, 2, 4),
                     message="全件取込完了 / 350件",
                     audience="admin,hr"),
            BatchJob(name="経費連携(バクラク)", status="success",
                     started_at=datetime(2026, 5, 17, 4, 0),
                     finished_at=datetime(2026, 5, 17, 4, 2),
                     message="承認済み経費を連携 / 12件",
                     audience="admin,hr,manager"),
            BatchJob(name="社員マスタ同期", status="success",
                     started_at=datetime(2026, 5, 17, 3, 0),
                     finished_at=datetime(2026, 5, 17, 3, 1),
                     message="差分0件",
                     audience="admin,hr"),
            BatchJob(name="アンケート配信", status="failed",
                     started_at=datetime(2026, 5, 16, 10, 0),
                     finished_at=datetime(2026, 5, 16, 10, 0),
                     message="SMTP接続失敗",
                     audience="admin,hr"),
            BatchJob(name="評価レポート生成", status="running",
                     started_at=datetime(2026, 5, 18, 1, 0),
                     finished_at=None, message=None,
                     audience="admin,hr,manager"),
        ])

        db.commit()
        print("seeded.")
        print("ログイン情報（email / password）:")
        for e in [admin, hr_user, mgr, m1, m2, sales_m, fin_m]:
            print(f"  {e.email:25s} / {e.email.split('@')[0]}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
