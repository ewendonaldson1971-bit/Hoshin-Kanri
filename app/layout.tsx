import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authEnv,
  getHoshinSessionUsername,
  safeReturnPath,
} from "../lib/auth/hoshin-auth";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const title = "Vivad SPARK — Quality, Training and Controlled Work";
  const description = "Access Vivad quality systems, training records, controlled procedures and learning videos in one place.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: new URL("/og.png", origin).toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [new URL("/og.png", origin).toString()],
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const username = await getHoshinSessionUsername(
    requestHeaders.get("cookie") ?? "",
    authEnv(),
  );

  if (!username) {
    const returnTo = safeReturnPath(
      requestHeaders.get("x-forwarded-uri") ??
        requestHeaders.get("x-original-url") ??
        "/",
    );
    redirect(`/hoshin-login?return_to=${encodeURIComponent(returnTo)}`);
  }

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
