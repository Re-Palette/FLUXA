// Minimal Google scopes per service (incremental authorization).
export const GOOGLE_SERVICE_SCOPES: Record<string, string[]> = {
  google_drive: ["https://www.googleapis.com/auth/drive.file"],
  google_sheets: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  gmail: ["https://www.googleapis.com/auth/gmail.compose"],
  google_calendar: ["https://www.googleapis.com/auth/calendar.events"],
};

export const GOOGLE_IDENTITY_SCOPES = ["openid", "email"];

export function isGoogleService(provider: string): boolean {
  return provider in GOOGLE_SERVICE_SCOPES;
}
