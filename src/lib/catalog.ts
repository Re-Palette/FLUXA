// Client-safe catalog of departments, responsibilities, employee templates, team packs and
// connection providers. The DB `EmployeeTemplate` table is seeded from EMPLOYEE_TEMPLATES.

export const INDUSTRIES = [
  "Technology",
  "SaaS",
  "Beauty",
  "E-commerce",
  "Education",
  "Finance",
  "Healthcare",
  "Media",
  "Consulting",
  "Restaurant",
  "Manufacturing",
  "Other",
] as const;

export const COMPANY_SIZES = ["Solo", "1–10", "11–50", "51–200", "201+"] as const;

export const DEPARTMENTS = [
  { key: "Executive", ja: "経営" },
  { key: "Marketing", ja: "マーケティング" },
  { key: "Sales", ja: "営業" },
  { key: "Research", ja: "リサーチ" },
  { key: "Product/Engineering", ja: "プロダクト・開発" },
  { key: "Finance", ja: "財務" },
  { key: "HR", ja: "人事" },
  { key: "Administration", ja: "管理" },
] as const;

export type DepartmentKey = (typeof DEPARTMENTS)[number]["key"];

export function departmentJa(key: string): string {
  return DEPARTMENTS.find((d) => d.key === key)?.ja ?? key;
}

// ───────────────────────── Connection providers ─────────────────────────

export type ProviderCategory = "AI" | "Google" | "Productivity" | "Social" | "Business";
export type ProviderKey =
  | "anthropic"
  | "openai"
  | "gemini"
  | "google_drive"
  | "google_sheets"
  | "gmail"
  | "google_calendar"
  | "notion"
  | "slack"
  | "github"
  | "instagram"
  | "youtube"
  | "x"
  | "google_analytics"
  | "meta_ads"
  | "shopify"
  | "stripe"
  | "hubspot";

export interface ProviderInfo {
  key: ProviderKey;
  name: string;
  /** Plain-language label for the connect button, e.g. "Connect Claude". */
  connectLabel: string;
  category: ProviderCategory;
  authType: "oauth" | "api_key";
  status: "available" | "coming_soon";
  description: string;
  /** Short hint shown next to the API-key field (never technical jargon on the main surface). */
  keyHint?: string;
  keyUrl?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { key: "anthropic", name: "Claude (Anthropic)", connectLabel: "Connect Claude", category: "AI", authType: "api_key", status: "available", description: "AI社員の頭脳として Claude を使用します。", keyHint: "Anthropic Console で発行したキー (sk-ant-…)", keyUrl: "https://console.anthropic.com/settings/keys" },
  { key: "openai", name: "OpenAI", connectLabel: "Connect OpenAI", category: "AI", authType: "api_key", status: "available", description: "AI社員の頭脳として OpenAI のモデルを使用します。", keyHint: "OpenAI Platform で発行したキー (sk-…)", keyUrl: "https://platform.openai.com/api-keys" },
  { key: "gemini", name: "Google Gemini", connectLabel: "Connect Gemini", category: "AI", authType: "api_key", status: "available", description: "AI社員の頭脳として Gemini を使用します。", keyHint: "Google AI Studio で発行したキー", keyUrl: "https://aistudio.google.com/apikey" },

  { key: "google_drive", name: "Google Drive", connectLabel: "Connect Google Drive", category: "Google", authType: "oauth", status: "available", description: "FLUXA が作成したファイルの作成・参照を行います（ドライブ全体にはアクセスしません）。" },
  { key: "google_sheets", name: "Google Sheets", connectLabel: "Connect Google Sheets", category: "Google", authType: "oauth", status: "available", description: "スプレッドシートを読み取り、データ分析に使います（読み取り専用）。" },
  { key: "gmail", name: "Gmail", connectLabel: "Connect Gmail", category: "Google", authType: "oauth", status: "available", description: "メールの下書き作成と、承認後の送信を行います。" },
  { key: "google_calendar", name: "Google Calendar", connectLabel: "Connect Google Calendar", category: "Google", authType: "oauth", status: "available", description: "予定の参照と、承認後の予定作成を行います。" },

  { key: "notion", name: "Notion", connectLabel: "Connect Notion", category: "Productivity", authType: "api_key", status: "available", description: "共有されたページを検索・参照します。", keyHint: "Notion のインテグレーションで発行したシークレット (ntn_… / secret_…)", keyUrl: "https://www.notion.so/profile/integrations" },
  { key: "slack", name: "Slack", connectLabel: "Connect Slack", category: "Productivity", authType: "api_key", status: "available", description: "チャンネルへの投稿（承認制）を行います。", keyHint: "Slack アプリの Bot User OAuth Token (xoxb-…)", keyUrl: "https://api.slack.com/apps" },
  { key: "github", name: "GitHub", connectLabel: "Connect GitHub", category: "Productivity", authType: "api_key", status: "available", description: "Issue の参照と作成（承認制）を行います。", keyHint: "Fine-grained personal access token (github_pat_…)", keyUrl: "https://github.com/settings/personal-access-tokens" },

  { key: "instagram", name: "Instagram", connectLabel: "Connect Instagram", category: "Social", authType: "oauth", status: "coming_soon", description: "投稿の作成・公開とインサイト取得。" },
  { key: "youtube", name: "YouTube", connectLabel: "Connect YouTube", category: "Social", authType: "oauth", status: "coming_soon", description: "チャンネル分析と動画情報の取得。" },
  { key: "x", name: "X", connectLabel: "Connect X", category: "Social", authType: "oauth", status: "coming_soon", description: "ポストの作成・公開と分析。" },
  { key: "google_analytics", name: "Google Analytics", connectLabel: "Connect Analytics", category: "Business", authType: "oauth", status: "coming_soon", description: "サイトのアクセス解析。" },
  { key: "meta_ads", name: "Meta Ads", connectLabel: "Connect Meta Ads", category: "Business", authType: "oauth", status: "coming_soon", description: "広告キャンペーンの分析と出稿（承認制）。" },
  { key: "shopify", name: "Shopify", connectLabel: "Connect Shopify", category: "Business", authType: "oauth", status: "coming_soon", description: "商品・注文データの参照。" },
  { key: "stripe", name: "Stripe", connectLabel: "Connect Stripe", category: "Business", authType: "api_key", status: "coming_soon", description: "売上・請求データの参照。" },
  { key: "hubspot", name: "HubSpot", connectLabel: "Connect HubSpot", category: "Business", authType: "oauth", status: "coming_soon", description: "CRM の顧客・商談データ。" },
];

export const PROVIDER_CATEGORIES: ProviderCategory[] = ["AI", "Google", "Productivity", "Social", "Business"];

export const AI_PROVIDER_KEYS = ["anthropic", "openai", "gemini"] as const;
export type AIProviderKey = (typeof AI_PROVIDER_KEYS)[number];

export function providerInfo(key: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.key === key);
}

export function isAIProvider(key: string): key is AIProviderKey {
  return (AI_PROVIDER_KEYS as readonly string[]).includes(key);
}

// ───────────────────────── Responsibilities ─────────────────────────

export interface ResponsibilityInfo {
  key: string;
  ja: string;
  en: string;
  /** Rule-based connection recommendations (strong = ✓ recommended, weak = ○ optional). */
  strong: ProviderKey[];
  weak: ProviderKey[];
}

const R = (key: string, ja: string, en: string, strong: ProviderKey[] = [], weak: ProviderKey[] = []): ResponsibilityInfo => ({ key, ja, en, strong, weak });

export const RESPONSIBILITIES: ResponsibilityInfo[] = [
  // Executive
  R("exec_briefing", "経営ブリーフィング作成", "Executive Briefing", ["google_drive"], ["gmail", "google_calendar"]),
  R("strategy_planning", "戦略立案", "Strategy Planning", ["google_drive"], ["notion"]),
  R("decision_support", "意思決定サポート", "Decision Support", ["google_drive"], ["google_sheets"]),
  R("schedule_management", "スケジュール管理", "Schedule Management", ["google_calendar"], ["gmail"]),
  R("final_review", "成果物の最終レビュー", "Final Review", [], ["google_drive"]),
  R("okr_tracking", "OKR・目標管理", "OKR Tracking", ["google_sheets"], ["notion"]),
  R("process_improvement", "業務プロセス改善", "Process Improvement", [], ["notion", "slack"]),
  R("weekly_company_report", "週次会社レポート", "Weekly Company Report", ["google_drive"], ["slack"]),
  // Marketing
  R("market_research", "市場調査", "Market Research", ["google_drive"], []),
  R("competitor_analysis", "競合分析", "Competitor Analysis", ["google_drive", "google_sheets"], []),
  R("sns_strategy", "SNS戦略", "SNS Strategy", ["google_drive"], ["instagram", "x"]),
  R("content_planning", "コンテンツ企画", "Content Planning", ["google_drive"], ["notion"]),
  R("post_creation", "投稿作成", "Post Creation", [], ["instagram", "x"]),
  R("campaign_planning", "キャンペーン企画", "Campaign Planning", ["google_drive"], ["google_calendar"]),
  R("ad_analysis", "広告分析", "Advertising Analysis", ["google_sheets"], ["meta_ads", "google_analytics"]),
  R("ad_operations", "広告運用", "Advertising Operations", [], ["meta_ads"]),
  R("marketing_report", "マーケティングレポート", "Marketing Report", ["google_drive", "google_sheets"], ["google_analytics"]),
  R("kpi_monitoring", "KPIモニタリング", "KPI Monitoring", ["google_sheets"], ["google_analytics"]),
  R("seo", "SEO対策", "SEO", [], ["google_analytics"]),
  R("email_marketing", "メールマーケティング", "Email Marketing", ["gmail"], ["hubspot"]),
  // Sales
  R("lead_research", "リード調査", "Lead Research", ["google_sheets"], ["hubspot"]),
  R("lead_list_creation", "リードリスト作成", "Lead List Creation", ["google_sheets"], ["hubspot"]),
  R("customer_research", "顧客調査", "Customer Research", ["google_drive"], ["hubspot"]),
  R("sales_email_drafting", "営業メール作成", "Sales Email Drafting", ["gmail"], []),
  R("meeting_preparation", "商談準備", "Meeting Preparation", ["google_calendar", "google_drive"], []),
  R("sales_analysis", "営業分析", "Sales Analysis", ["google_sheets"], ["stripe", "hubspot"]),
  R("pipeline_management", "パイプライン管理", "Pipeline Management", ["google_sheets"], ["hubspot"]),
  R("sales_report", "営業レポート", "Sales Report", ["google_drive", "google_sheets"], []),
  R("customer_support", "カスタマーサポート", "Customer Support", ["gmail"], ["slack"]),
  R("onboarding_support", "顧客オンボーディング", "Customer Onboarding", ["gmail", "google_calendar"], []),
  // Research
  R("trend_research", "トレンド調査", "Trend Research", ["google_drive"], []),
  R("competitor_research", "競合リサーチ", "Competitor Research", ["google_drive"], []),
  R("academic_research", "学術リサーチ", "Academic Research", ["google_drive"], ["notion"]),
  R("data_analysis", "データ分析", "Data Analysis", ["google_sheets"], ["google_drive"]),
  R("report_generation", "レポート作成", "Report Generation", ["google_drive"], []),
  // Product / Engineering
  R("product_roadmap", "ロードマップ策定", "Product Roadmap", ["notion"], ["github"]),
  R("spec_writing", "仕様書作成", "Spec Writing", ["google_drive"], ["notion", "github"]),
  R("issue_triage", "Issue 整理", "Issue Triage", ["github"], ["slack"]),
  R("code_review_support", "コードレビュー支援", "Code Review Support", ["github"], []),
  R("test_planning", "テスト計画", "Test Planning", ["github"], ["google_sheets"]),
  R("bug_reporting", "バグレポート", "Bug Reporting", ["github"], ["slack"]),
  // Finance
  R("expense_analysis", "経費分析", "Expense Analysis", ["google_sheets"], ["stripe"]),
  R("revenue_analysis", "売上分析", "Revenue Analysis", ["google_sheets"], ["stripe"]),
  R("financial_reports", "財務レポート", "Financial Reports", ["google_sheets", "google_drive"], []),
  R("budget_monitoring", "予算モニタリング", "Budget Monitoring", ["google_sheets"], []),
  R("cash_flow_analysis", "キャッシュフロー分析", "Cash Flow Analysis", ["google_sheets"], ["stripe"]),
  R("invoice_preparation", "請求書準備", "Invoice Preparation", ["google_drive"], ["stripe", "gmail"]),
  // HR
  R("candidate_research", "候補者リサーチ", "Candidate Research", ["google_sheets"], []),
  R("job_description", "求人票作成", "Job Description Creation", ["google_drive"], []),
  R("recruitment_analysis", "採用分析", "Recruitment Analysis", ["google_sheets"], []),
  R("interview_preparation", "面接準備", "Interview Preparation", ["google_calendar", "google_drive"], []),
  R("onboarding_docs", "入社手続き資料作成", "Onboarding Documents", ["google_drive"], ["notion"]),
  // Administration
  R("document_management", "書類管理", "Document Management", ["google_drive"], ["notion"]),
  R("email_triage", "メール整理", "Email Triage", ["gmail"], []),
  R("meeting_minutes", "議事録作成", "Meeting Minutes", ["google_drive"], ["google_calendar"]),
  R("contract_review", "契約書チェック", "Contract Review", ["google_drive"], []),
  R("compliance_check", "コンプライアンス確認", "Compliance Check", ["google_drive"], []),
];

export function responsibilityInfo(key: string | null | undefined): ResponsibilityInfo | undefined {
  if (!key) return undefined;
  return RESPONSIBILITIES.find((r) => r.key === key);
}

// ───────────────────────── Employee templates ─────────────────────────

export interface EmployeeTemplateInfo {
  key: string;
  name: string;
  department: DepartmentKey;
  description: string;
  recommendedUse: string;
  defaultMission: string;
  responsibilities: string[]; // responsibility keys offered for this role
  defaultResponsibilities: string[]; // pre-checked
  suggestedTools: ProviderKey[];
}

export const EMPLOYEE_TEMPLATES: EmployeeTemplateInfo[] = [
  // Executive
  { key: "ceo_assistant", name: "CEO Assistant", department: "Executive", description: "経営判断のサポート、戦略立案、意思決定の補佐を行います。", recommendedUse: "経営者の右腕として全体を俯瞰したい", defaultMission: "経営者が最も重要な意思決定に集中できるよう、情報を整理し、会社全体の成果を最大化する", responsibilities: ["exec_briefing", "strategy_planning", "decision_support", "schedule_management", "final_review", "weekly_company_report"], defaultResponsibilities: ["exec_briefing", "decision_support", "final_review", "weekly_company_report"], suggestedTools: ["google_drive", "gmail", "google_calendar"] },
  { key: "strategy_manager", name: "Strategy Manager", department: "Executive", description: "中長期の事業戦略と重点施策を設計します。", recommendedUse: "新規事業や成長戦略を練りたい", defaultMission: "データに基づいた戦略で、会社の持続的な成長を実現する", responsibilities: ["strategy_planning", "market_research", "competitor_analysis", "okr_tracking", "decision_support"], defaultResponsibilities: ["strategy_planning", "okr_tracking"], suggestedTools: ["google_drive", "google_sheets"] },
  { key: "operations_manager", name: "Operations Manager", department: "Executive", description: "業務フローの設計と改善、進捗管理を行います。", recommendedUse: "チームの業務を効率化したい", defaultMission: "無駄のないオペレーションで、会社の生産性を最大化する", responsibilities: ["process_improvement", "okr_tracking", "schedule_management", "document_management", "weekly_company_report"], defaultResponsibilities: ["process_improvement", "okr_tracking"], suggestedTools: ["google_sheets", "notion", "slack"] },
  // Marketing
  { key: "marketing_manager", name: "Marketing Manager", department: "Marketing", description: "マーケティング戦略の立案・実行、市場調査を行います。", recommendedUse: "認知拡大と顧客獲得を強化したい", defaultMission: "会社の認知度と顧客獲得を最大化する", responsibilities: ["market_research", "competitor_analysis", "sns_strategy", "content_planning", "post_creation", "campaign_planning", "ad_analysis", "marketing_report", "kpi_monitoring", "email_marketing"], defaultResponsibilities: ["market_research", "competitor_analysis", "sns_strategy", "content_planning", "marketing_report"], suggestedTools: ["google_drive", "google_sheets", "instagram", "google_analytics"] },
  { key: "sns_manager", name: "SNS Manager", department: "Marketing", description: "SNS企画・運用、エンゲージメント向上を行います。", recommendedUse: "SNS 運用を任せたい", defaultMission: "SNS でブランドのファンを増やし、エンゲージメントを高める", responsibilities: ["sns_strategy", "content_planning", "post_creation", "kpi_monitoring", "trend_research"], defaultResponsibilities: ["sns_strategy", "post_creation", "kpi_monitoring"], suggestedTools: ["instagram", "x", "google_drive"] },
  { key: "content_creator", name: "Content Creator", department: "Marketing", description: "ブログ・SNS・資料などのコンテンツを制作します。", recommendedUse: "発信するコンテンツを増やしたい", defaultMission: "顧客に価値を届ける質の高いコンテンツを継続的に生み出す", responsibilities: ["content_planning", "post_creation", "seo", "email_marketing"], defaultResponsibilities: ["content_planning", "post_creation"], suggestedTools: ["google_drive", "notion"] },
  { key: "advertising_manager", name: "Advertising Manager", department: "Marketing", description: "広告の企画・運用・効果分析を行います。", recommendedUse: "広告の費用対効果を高めたい", defaultMission: "広告投資のリターンを最大化する", responsibilities: ["ad_operations", "ad_analysis", "campaign_planning", "kpi_monitoring", "marketing_report"], defaultResponsibilities: ["ad_analysis", "campaign_planning"], suggestedTools: ["meta_ads", "google_analytics", "google_sheets"] },
  // Sales
  { key: "sales_manager", name: "Sales Manager", department: "Sales", description: "営業戦略の立案・実行、顧客開拓を行います。", recommendedUse: "売上を伸ばしたい", defaultMission: "顧客との関係を築き、売上を継続的に成長させる", responsibilities: ["lead_research", "lead_list_creation", "customer_research", "sales_email_drafting", "meeting_preparation", "sales_analysis", "pipeline_management", "sales_report"], defaultResponsibilities: ["lead_research", "sales_email_drafting", "pipeline_management", "sales_report"], suggestedTools: ["gmail", "google_sheets", "google_calendar", "hubspot"] },
  { key: "lead_generation", name: "Lead Generation", department: "Sales", description: "見込み顧客の調査とリスト化を行います。", recommendedUse: "新規リードを増やしたい", defaultMission: "質の高い見込み顧客を継続的に発掘する", responsibilities: ["lead_research", "lead_list_creation", "customer_research"], defaultResponsibilities: ["lead_research", "lead_list_creation"], suggestedTools: ["google_sheets", "hubspot"] },
  { key: "sales_assistant", name: "Sales Assistant", department: "Sales", description: "営業メールや商談資料の準備を行います。", recommendedUse: "営業の事務作業を減らしたい", defaultMission: "営業チームが顧客との対話に集中できるよう支援する", responsibilities: ["sales_email_drafting", "meeting_preparation", "sales_report"], defaultResponsibilities: ["sales_email_drafting", "meeting_preparation"], suggestedTools: ["gmail", "google_calendar", "google_drive"] },
  { key: "customer_success_manager", name: "Customer Success Manager", department: "Sales", description: "既存顧客の成功支援と継続率向上を担います。", recommendedUse: "解約を減らし顧客満足度を上げたい", defaultMission: "顧客の成功を通じて、長期的な関係と継続収益を築く", responsibilities: ["customer_support", "onboarding_support", "customer_research", "sales_report"], defaultResponsibilities: ["customer_support", "onboarding_support"], suggestedTools: ["gmail", "slack", "hubspot"] },
  // Research
  { key: "market_researcher", name: "Market Researcher", department: "Research", description: "市場調査、競合分析、データ収集・分析を行います。", recommendedUse: "市場や競合を深く理解したい", defaultMission: "正確な市場インサイトで、会社の意思決定の質を高める", responsibilities: ["market_research", "trend_research", "competitor_research", "academic_research", "data_analysis", "report_generation"], defaultResponsibilities: ["market_research", "trend_research", "competitor_research", "report_generation"], suggestedTools: ["google_drive", "google_sheets"] },
  { key: "competitor_analyst", name: "Competitor Analyst", department: "Research", description: "競合他社の動向を継続的に分析します。", recommendedUse: "競合の動きを常に把握したい", defaultMission: "競合の動向を先回りして捉え、優位性を築く", responsibilities: ["competitor_research", "competitor_analysis", "trend_research", "report_generation"], defaultResponsibilities: ["competitor_research", "report_generation"], suggestedTools: ["google_drive", "google_sheets"] },
  { key: "data_analyst", name: "Data Analyst", department: "Research", description: "データの集計・可視化・分析を行います。", recommendedUse: "データから示唆を得たい", defaultMission: "データを意思決定に使えるインサイトへ変える", responsibilities: ["data_analysis", "kpi_monitoring", "report_generation", "sales_analysis"], defaultResponsibilities: ["data_analysis", "report_generation"], suggestedTools: ["google_sheets", "google_drive"] },
  // Product / Engineering
  { key: "product_manager", name: "Product Manager", department: "Product/Engineering", description: "プロダクト戦略の立案、開発の進行管理を行います。", recommendedUse: "プロダクト開発を前に進めたい", defaultMission: "顧客に愛されるプロダクトを、正しい優先順位で届ける", responsibilities: ["product_roadmap", "spec_writing", "issue_triage", "customer_research", "test_planning"], defaultResponsibilities: ["product_roadmap", "spec_writing", "issue_triage"], suggestedTools: ["notion", "github", "google_drive"] },
  { key: "software_engineer", name: "Software Engineer", department: "Product/Engineering", description: "技術調査、設計、Issue 整理、コードレビュー支援を行います。", recommendedUse: "開発チームの生産性を上げたい", defaultMission: "信頼性の高いソフトウェアを素早く届ける", responsibilities: ["spec_writing", "issue_triage", "code_review_support", "bug_reporting"], defaultResponsibilities: ["issue_triage", "code_review_support"], suggestedTools: ["github", "notion"] },
  { key: "qa_tester", name: "QA / Tester", department: "Product/Engineering", description: "テスト計画とバグレポートを作成します。", recommendedUse: "品質を安定させたい", defaultMission: "ユーザーが安心して使える品質を守る", responsibilities: ["test_planning", "bug_reporting", "issue_triage"], defaultResponsibilities: ["test_planning", "bug_reporting"], suggestedTools: ["github", "google_sheets"] },
  // Finance
  { key: "finance_manager", name: "Finance Manager", department: "Finance", description: "財務状況の管理、予算・キャッシュフローの監視を行います。", recommendedUse: "お金の流れを見える化したい", defaultMission: "健全な財務基盤で、会社の成長投資を支える", responsibilities: ["expense_analysis", "revenue_analysis", "financial_reports", "budget_monitoring", "cash_flow_analysis"], defaultResponsibilities: ["revenue_analysis", "financial_reports", "budget_monitoring"], suggestedTools: ["google_sheets", "google_drive", "stripe"] },
  { key: "financial_analyst", name: "Financial Analyst", department: "Finance", description: "売上・コストの分析と予測を行います。", recommendedUse: "数字に基づく計画を立てたい", defaultMission: "正確な分析と予測で、財務判断の精度を高める", responsibilities: ["revenue_analysis", "expense_analysis", "cash_flow_analysis", "financial_reports"], defaultResponsibilities: ["revenue_analysis", "cash_flow_analysis"], suggestedTools: ["google_sheets", "stripe"] },
  { key: "accounting_assistant", name: "Accounting Assistant", department: "Finance", description: "経費整理や請求書準備などの経理業務を補助します。", recommendedUse: "経理の手間を減らしたい", defaultMission: "正確で滞りのない経理処理を支える", responsibilities: ["expense_analysis", "invoice_preparation", "document_management"], defaultResponsibilities: ["expense_analysis", "invoice_preparation"], suggestedTools: ["google_sheets", "google_drive", "gmail"] },
  // HR
  { key: "hr_manager", name: "HR Manager", department: "HR", description: "人事制度、入社手続き、組織づくりを支援します。", recommendedUse: "組織づくりを整えたい", defaultMission: "人が力を発揮できる組織をつくる", responsibilities: ["onboarding_docs", "recruitment_analysis", "job_description", "interview_preparation"], defaultResponsibilities: ["onboarding_docs", "job_description"], suggestedTools: ["google_drive", "google_calendar", "notion"] },
  { key: "recruiting_manager", name: "Recruiting Manager", department: "HR", description: "候補者リサーチ、求人票作成、面接準備を行います。", recommendedUse: "採用を強化したい", defaultMission: "会社の成長に必要な仲間を見つける", responsibilities: ["candidate_research", "job_description", "recruitment_analysis", "interview_preparation"], defaultResponsibilities: ["candidate_research", "job_description", "interview_preparation"], suggestedTools: ["google_sheets", "google_calendar", "gmail"] },
  // Administration
  { key: "administrative_assistant", name: "Administrative Assistant", department: "Administration", description: "書類整理、メール整理、議事録作成などを行います。", recommendedUse: "日々の事務作業を任せたい", defaultMission: "日々の業務を整え、チームが本業に集中できる環境をつくる", responsibilities: ["document_management", "email_triage", "meeting_minutes", "schedule_management"], defaultResponsibilities: ["document_management", "meeting_minutes"], suggestedTools: ["google_drive", "gmail", "google_calendar"] },
  { key: "legal_assistant", name: "Legal Assistant", department: "Administration", description: "契約書のチェックやコンプライアンス確認を補助します。", recommendedUse: "法務リスクを早めに把握したい", defaultMission: "法務リスクを未然に防ぎ、安心して事業を進められるようにする", responsibilities: ["contract_review", "compliance_check", "document_management"], defaultResponsibilities: ["contract_review", "compliance_check"], suggestedTools: ["google_drive"] },
];

export function templateInfo(key: string | null | undefined): EmployeeTemplateInfo | undefined {
  if (!key) return undefined;
  return EMPLOYEE_TEMPLATES.find((t) => t.key === key);
}

// ───────────────────────── Team packs ─────────────────────────

export interface TeamPack {
  key: string;
  name: string;
  description: string;
  templates: string[];
}

export const TEAM_PACKS: TeamPack[] = [
  { key: "startup", name: "Startup Pack", description: "少人数で事業を立ち上げるための基本チーム", templates: ["ceo_assistant", "market_researcher", "marketing_manager", "sales_manager", "operations_manager"] },
  { key: "ecommerce", name: "E-commerce Pack", description: "EC 事業の運営・販売・分析チーム", templates: ["product_manager", "marketing_manager", "customer_success_manager", "sales_manager", "data_analyst"] },
  { key: "saas", name: "SaaS Pack", description: "SaaS の開発・成長・顧客成功チーム", templates: ["product_manager", "software_engineer", "marketing_manager", "sales_manager", "customer_success_manager"] },
];

// ───────────────────────── Onboarding steps ─────────────────────────

export const ONBOARDING_STEPS = [
  { n: 1, key: "company", label: "会社", en: "Company" },
  { n: 2, key: "employees", label: "AI社員", en: "Employees" },
  { n: 3, key: "responsibilities", label: "仕事内容", en: "Responsibilities" },
  { n: 4, key: "connections", label: "連携", en: "Connections" },
  { n: 5, key: "permissions", label: "権限", en: "Permissions" },
  { n: 6, key: "launch", label: "起動", en: "Launch" },
] as const;
