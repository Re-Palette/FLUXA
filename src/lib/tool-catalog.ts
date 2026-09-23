// Client-safe tool metadata. Server implementations live in src/server/tools.

export type ToolEffect = "read" | "internal_write" | "external_write";
export type RiskTag = "email" | "social_post" | "ads" | "delete" | "money" | "contract" | "external_write";
export type Policy = "ALLOW" | "REQUIRE_APPROVAL" | "DENY";

export interface ToolInfo {
  name: string;
  /** "builtin" tools need no connection. Otherwise a ProviderKey. */
  provider: string;
  label: string;
  description: string;
  effect: ToolEffect;
  riskTags: RiskTag[];
  defaultPolicy: Policy;
  available: boolean;
}

/** Risk tags that can never be fully automated: the policy floor is REQUIRE_APPROVAL. */
export const APPROVAL_FLOOR_TAGS: RiskTag[] = ["money", "contract", "delete", "ads"];

export const RISK_LABELS: Record<RiskTag, string> = {
  email: "外部メール送信",
  social_post: "SNS投稿",
  ads: "広告出稿",
  delete: "データ削除",
  money: "金銭に関わる操作",
  contract: "契約関連",
  external_write: "外部サービスへの書き込み",
};

export const TOOLS: ToolInfo[] = [
  { name: "report.create", provider: "builtin", label: "レポート作成", description: "成果物をレポートとして保存します", effect: "internal_write", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "memory.search", provider: "builtin", label: "会社メモリ検索", description: "会社の方針・過去の決定・資料を検索します", effect: "read", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "memory.save", provider: "builtin", label: "会社メモリに記録", description: "重要な発見や決定を会社メモリに残します", effect: "internal_write", riskTags: [], defaultPolicy: "ALLOW", available: true },

  { name: "google_drive.search", provider: "google_drive", label: "Drive ファイル検索", description: "FLUXA で作成・選択したファイルを検索します", effect: "read", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "google_drive.read", provider: "google_drive", label: "Drive ファイル読み取り", description: "ドキュメントの内容を読み取ります", effect: "read", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "google_drive.create_document", provider: "google_drive", label: "ドキュメント作成", description: "Google ドキュメントを新規作成します", effect: "external_write", riskTags: ["external_write"], defaultPolicy: "ALLOW", available: true },
  { name: "google_sheets.read", provider: "google_sheets", label: "スプレッドシート読み取り", description: "指定したシートの値を読み取ります", effect: "read", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "gmail.create_draft", provider: "gmail", label: "メール下書き作成", description: "Gmail に下書きを作成します（送信はしません）", effect: "external_write", riskTags: ["external_write"], defaultPolicy: "ALLOW", available: true },
  { name: "gmail.send", provider: "gmail", label: "外部メール送信", description: "Gmail からメールを送信します", effect: "external_write", riskTags: ["email"], defaultPolicy: "REQUIRE_APPROVAL", available: true },
  { name: "google_calendar.list_events", provider: "google_calendar", label: "予定の参照", description: "直近の予定を取得します", effect: "read", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "google_calendar.create_event", provider: "google_calendar", label: "予定の作成", description: "カレンダーに予定を作成します（招待メールが送られる場合があります）", effect: "external_write", riskTags: ["external_write"], defaultPolicy: "REQUIRE_APPROVAL", available: true },
  { name: "notion.search", provider: "notion", label: "Notion 検索", description: "共有されたページを検索します", effect: "read", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "notion.read_page", provider: "notion", label: "Notion ページ読み取り", description: "ページの本文を読み取ります", effect: "read", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "slack.post_message", provider: "slack", label: "Slack 投稿", description: "チャンネルにメッセージを投稿します", effect: "external_write", riskTags: ["external_write"], defaultPolicy: "REQUIRE_APPROVAL", available: true },
  { name: "github.list_issues", provider: "github", label: "Issue 一覧", description: "リポジトリの Issue を取得します", effect: "read", riskTags: [], defaultPolicy: "ALLOW", available: true },
  { name: "github.create_issue", provider: "github", label: "Issue 作成", description: "リポジトリに Issue を作成します", effect: "external_write", riskTags: ["external_write"], defaultPolicy: "REQUIRE_APPROVAL", available: true },

  { name: "instagram.publish_post", provider: "instagram", label: "SNS投稿の公開", description: "Instagram に投稿を公開します", effect: "external_write", riskTags: ["social_post"], defaultPolicy: "REQUIRE_APPROVAL", available: false },
  { name: "x.publish_post", provider: "x", label: "X へのポスト", description: "X にポストを公開します", effect: "external_write", riskTags: ["social_post"], defaultPolicy: "REQUIRE_APPROVAL", available: false },
  { name: "meta_ads.launch_campaign", provider: "meta_ads", label: "広告出稿", description: "広告キャンペーンを開始します", effect: "external_write", riskTags: ["ads", "money"], defaultPolicy: "REQUIRE_APPROVAL", available: false },
  { name: "stripe.create_refund", provider: "stripe", label: "返金処理", description: "Stripe で返金を実行します", effect: "external_write", riskTags: ["money"], defaultPolicy: "REQUIRE_APPROVAL", available: false },
];

export function toolInfo(name: string): ToolInfo | undefined {
  return TOOLS.find((t) => t.name === name);
}

export function toolsForProvider(provider: string): ToolInfo[] {
  return TOOLS.filter((t) => t.provider === provider);
}

/** Clamp a requested policy so risky tools can never be fully automated. */
export function clampPolicy(tool: ToolInfo, requested: Policy): Policy {
  if (requested === "ALLOW" && tool.riskTags.some((t) => APPROVAL_FLOOR_TAGS.includes(t))) {
    return "REQUIRE_APPROVAL";
  }
  return requested;
}

export const POLICY_LABELS: Record<Policy, string> = {
  ALLOW: "許可",
  REQUIRE_APPROVAL: "承認が必要",
  DENY: "禁止",
};
