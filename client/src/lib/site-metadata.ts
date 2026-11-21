import type { Metadata } from "next";
import { facultyFullName } from "@/lib/brand";

const FALLBACK_SITE_URL = "http://localhost:3000";

/**
 * เลือก base URL ของเว็บจากค่า env — ถ้าใส่หลาย origin คั่นด้วย comma จะใช้ตัวแรกที่ valid
 * (metadataBase ของ Next รับได้แค่ URL เดียว)
 */
export const resolveSiteUrl = (raw?: string | null): string => {
  const candidates = (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // ลองค่าถัดไป
    }
  }

  return FALLBACK_SITE_URL;
};

const buildSiteUrl = (): string => {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    return resolveSiteUrl(configuredSiteUrl);
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionUrl) {
    return resolveSiteUrl(`https://${vercelProductionUrl}`);
  }

  const vercelDeploymentUrl = process.env.VERCEL_URL?.trim();
  if (vercelDeploymentUrl) {
    return resolveSiteUrl(`https://${vercelDeploymentUrl}`);
  }

  return FALLBACK_SITE_URL;
};

export const siteName = "NUCARE";
export const defaultTitle = "NUCARE | Student Mental Health Care System";
export const defaultDescription = `ระบบดูแลและติดตามสุขภาวะนักศึกษา ${facultyFullName}`;
export const metadataBase = new URL(buildSiteUrl());

type CreatePageMetadataOptions = {
  description: string;
  keywords?: string[];
  noIndex?: boolean;
  path: string;
  title: string;
};

export const createPageMetadata = ({
  description,
  keywords,
  noIndex = false,
  path,
  title,
}: CreatePageMetadataOptions): Metadata => ({
  title,
  description,
  keywords,
  alternates: {
    canonical: path,
  },
  openGraph: {
    title,
    description,
    url: path,
    siteName,
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: noIndex
    ? {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
        },
      },
});

export const rootMetadata: Metadata = {
  metadataBase,
  applicationName: siteName,
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: "/",
    siteName,
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
};
