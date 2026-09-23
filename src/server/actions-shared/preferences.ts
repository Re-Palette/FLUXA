"use server";
import { cookies } from "next/headers";

export async function setThemeAction(theme: "dark" | "light") {
  (await cookies()).set("fluxa_theme", theme === "light" ? "light" : "dark", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
