export enum Platform {
  VIDEO_ACCOUNT = '视频号',
  BILIBILI = 'B站',
  TENCENT_VIDEO = '腾讯视频',
  TENCENT_NEWS = '腾讯新闻',
  WECHAT_MP = '公众号',
  XIAOHONGSHU = '小红书',
  ZHIHU = '知乎'
}

export enum ImageSource {
  AI_GENERATION = 'AI 文生图 (Gemini)',
  GOOGLE_SEARCH = 'Google 图片搜索',
  STOCK_LIBRARY = '视觉中国 / Unsplash'
}

export interface TitleOption {
  text: string;
  reason: string;
}

export interface KeywordItem {
  cn: string;
  en: string;
}

export interface AnalysisResult {
  titles: TitleOption[];
  keywords: KeywordItem[];
  imageSearchTerms: string[]; // Kept for broader context if needed
}

export interface ImageResult {
  id: string;
  url: string;
  source: ImageSource;
}