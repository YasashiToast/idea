export enum Platform {
  XIAOHONGSHU = '小红书',
  WECHAT_MP = '微信公众号',
  ZHIHU = '知乎',
  TENCENT_NEWS = '腾讯新闻',
  DOUYIN = '抖音',
  BILIBILI = 'B站'
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
