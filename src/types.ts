export interface ImageLinkItem {
  id: number;
  shortId: string;
  originalFileName: string;
  imageUrl: string;
  processedImageUrl: string;
  destinationUrl: string;
  description: string;
  framingMode: 'crop_16_9' | 'full';
  createdAt: string;
  clickCount: number;
  status: 'active' | 'disabled';
  telegramUserId?: string | null;
  publicUrl?: string;
}

export interface ClickEventItem {
  id: number;
  imageLinkId: number;
  timestamp: string;
  userAgent: string;
  referer: string;
}

export interface OverallStats {
  totalLinks: number;
  totalClicks: number;
  activeLinks: number;
  disabledLinks: number;
}

export interface CrawlerTestResult {
  status: number;
  shortId: string;
  canonicalUrl: string;
  destinationUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  imageDimensions: { width: number; height: number };
  framingMode: string;
  linkStatus: string;
  clickCount: number;
  rawHtml: string;
}

export interface BotInfo {
  configured: boolean;
  tokenMasked: string;
  appUrl: string;
  bot?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups?: boolean;
  } | null;
  webhook?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  } | null;
}

