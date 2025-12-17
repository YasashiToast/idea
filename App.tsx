import React, { useState, useCallback } from 'react';
import { generateContentAnalysis, generateAiImages, generateStockImages } from './services/geminiService';
import { Platform, AnalysisResult, ImageSource, ImageResult, KeywordItem } from './types';
import { PlatformSelector } from './components/PlatformSelector';
import { ImageEditor } from './components/ImageEditor';

// Helper component for individual image items with loading state
interface ImageCardProps {
  img: ImageResult;
  isSelected: boolean;
  onSelect: () => void;
  index: number; // Added index for staggered animation
}

const ImageCard: React.FC<ImageCardProps> = ({ img, isSelected, onSelect, index }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <button
      onClick={onSelect}
      style={{ 
        animationDelay: `${index * 100}ms`,
        animationFillMode: 'both' 
      }}
      className={`relative aspect-square rounded-lg overflow-hidden group focus:outline-none transition-all bg-slate-100 animate-slide-up-fade ${
        isSelected 
          ? 'ring-4 ring-indigo-600 ring-offset-2 scale-105 z-10' 
          : 'opacity-100 hover:scale-105'
      }`}
    >
      {/* Loading Skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200 z-0">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
           <svg className="w-8 h-8 text-slate-400 animate-bounce mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
           </svg>
           <span className="text-xs text-slate-500 font-medium relative z-10">加载中...</span>
        </div>
      )}
      
      {/* Error State */}
      {hasError && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-2">
            <span className="text-xs text-center">加载失败</span>
         </div>
      )}

      <img 
        src={img.url} 
        alt="Result" 
        className={`w-full h-full object-cover transition-all duration-700 ease-out ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => { setIsLoaded(true); setHasError(true); }}
      />
      
      {/* Selected Overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-indigo-900/10 flex items-center justify-center z-20">
          <div className="bg-white rounded-full p-1 shadow-md animate-pop-in">
            <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
};

function App() {
  const [inputText, setInputText] = useState('');
  const [platform, setPlatform] = useState<Platform>(Platform.XIAOHONGSHU);
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Image Generation State
  const [selectedKeywords, setSelectedKeywords] = useState<KeywordItem[]>([]);
  // CHANGED: Default to AI_GENERATION as per request
  const [imageSource, setImageSource] = useState<ImageSource>(ImageSource.AI_GENERATION);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false); // Track if a fetch has occurred
  const [generatedImages, setGeneratedImages] = useState<ImageResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [page, setPage] = useState(1); // Pagination for stock images

  // Step 1: Analyze Text
  const handleAnalyze = useCallback(async () => {
    if (!inputText.trim()) {
      setError('请输入内容文本');
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setGeneratedImages([]);
    setSelectedKeywords([]);
    setSelectedImage(null);
    setHasAttemptedFetch(false);
    setPage(1);

    try {
      const data = await generateContentAnalysis(inputText, platform);
      setAnalysisResult(data);
      // Pre-select top 3 keywords
      setSelectedKeywords(data.keywords.slice(0, 3));
    } catch (err: any) {
      setError(err.message || "分析失败，请重试");
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputText, platform]);

  const handleCopyTitle = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Step 2: Handle Keyword Toggling
  const toggleKeyword = (kwItem: KeywordItem) => {
    setSelectedKeywords(prev => {
      const exists = prev.some(k => k.cn === kwItem.cn);
      if (exists) {
        return prev.filter(k => k.cn !== kwItem.cn);
      } else {
        return [...prev, kwItem];
      }
    });
  };

  // Step 3: Fetch Images based on Keywords & Source
  const handleFetchImages = async (isRefresh = false) => {
    if (!analysisResult || selectedKeywords.length === 0) return;
    
    setIsGeneratingImages(true);
    setError(null);
    
    // Determine new page
    const newPage = isRefresh ? page + 1 : 1;
    setPage(newPage);

    if (!isRefresh) {
        setHasAttemptedFetch(false);
    }
    
    // Clear existing images to show loading state implies refresh
    setGeneratedImages([]);
    setSelectedImage(null);

    try {
      let images: ImageResult[] = [];
      const searchTerms = selectedKeywords.map(k => k.en);

      // Prioritize Stock Search, offer AI as option
      if (imageSource === ImageSource.AI_GENERATION) {
        images = await generateAiImages(searchTerms);
      } else {
        images = await generateStockImages(searchTerms, ImageSource.STOCK_LIBRARY, newPage);
      }
      
      setGeneratedImages(images);
    } catch (err: any) {
      setError("图片生成/检索失败，请切换源重试");
      console.error(err);
    } finally {
      setIsGeneratingImages(false);
      setHasAttemptedFetch(true);
    }
  };

  const handleSwitchToAi = () => {
    setImageSource(ImageSource.AI_GENERATION);
    // User needs to click the button to confirm context and start generation
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <style>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          80% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-slide-up-fade {
          animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0; /* Initially hidden */
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite linear;
        }
        .animate-pop-in {
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              AI
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              自媒体加油站
            </h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">
             智能多平台文案配图助手
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                1. 选择发布平台
              </label>
              <PlatformSelector selected={platform} onChange={setPlatform} />
              
              <label className="block text-sm font-bold text-slate-700 mt-6 mb-2">
                2. 输入文本内容
              </label>
              <textarea
                className="w-full h-48 p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none transition-all text-base leading-relaxed"
                placeholder="在此粘贴您的文章草稿、笔记内容或想法..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />

              <div className="mt-6">
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !inputText.trim()}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                    isAnalyzing || !inputText.trim()
                      ? 'bg-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      文案分析中...
                    </>
                  ) : (
                    <>
                      ✨ 智能分析
                    </>
                  )}
                </button>
                {error && (
                  <p className="mt-3 text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
                    {error}
                  </p>
                )}
              </div>
            </div>

            {/* API Key info */}
            <div className="bg-blue-50 text-blue-800 text-xs p-4 rounded-xl border border-blue-100">
               <p className="font-semibold mb-1">模型支持</p>
               • 文本分析: Gemini 2.5 Flash<br/>
               • AI 绘图: Gemini 2.5 Flash Image (Nano Banana)
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7 space-y-6">
            {!analysisResult && !isAnalyzing && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-3xl">
                  📝
                </div>
                <h3 className="text-lg font-medium text-slate-600">等待输入</h3>
                <p className="max-w-xs mt-2 text-sm">
                  请先进行文案分析，系统将提取关键词供您选择配图。
                </p>
              </div>
            )}

            {analysisResult && (
              <div className="space-y-6 animate-fade-in-up">
                
                {/* Titles Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-50 to-indigo-50 px-6 py-4 border-b border-indigo-100">
                    <h2 className="font-bold text-indigo-900 flex items-center gap-2">
                      <span className="text-xl">🔥</span> 爆款标题推荐
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {analysisResult.titles.map((title, idx) => (
                      <div key={idx} className="p-6 hover:bg-slate-50 transition-colors group relative">
                        <div className="flex items-start gap-4 pr-16">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold mt-1">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2 leading-snug group-hover:text-indigo-700 transition-colors">
                              {title.text}
                            </h3>
                            <p className="text-sm text-slate-500 bg-slate-100 inline-block px-3 py-1.5 rounded-lg border border-slate-200">
                              💡 {title.reason}
                            </p>
                          </div>
                        </div>
                        
                        {/* Copy Button (Icon Only) */}
                        <div className="absolute right-4 top-6">
                          <button 
                            onClick={() => handleCopyTitle(title.text, idx)}
                            title="复制标题"
                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm ${
                              copiedIndex === idx 
                                ? 'bg-green-100 text-green-600 scale-110'
                                : 'bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-md'
                            }`}
                          >
                            {copiedIndex === idx ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Keywords Selection Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <span>🏷️</span> 选择配图关键词
                  </h2>
                  <p className="text-sm text-slate-500 mb-4">
                    点击选中核心关键词，作为图片搜索/生成的依据。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.keywords.map((kwItem, idx) => {
                      const isSelected = selectedKeywords.some(k => k.cn === kwItem.cn);
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleKeyword(kwItem)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                          }`}
                        >
                          {isSelected && <span className="mr-1">✓</span>}
                          #{kwItem.cn}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Image Generation/Search Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                   <div className="mb-6">
                     <div className="flex items-center justify-between mb-4">
                       <h2 className="font-bold text-slate-800 flex items-center gap-2">
                         <span>🖼️</span> 配图推荐
                       </h2>
                       {/* Refresh Button - Only show if images exist or attempted fetch */}
                       {(generatedImages.length > 0) && !isGeneratingImages && (
                          <button 
                            onClick={() => handleFetchImages(true)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            换一换
                          </button>
                       )}
                     </div>
                     
                     {/* Simplified Source Toggle - Reordered & Recommendation Label Updated */}
                     <div className="flex p-1 bg-slate-100 rounded-xl mb-4 w-fit">
                        <button
                          onClick={() => { setImageSource(ImageSource.AI_GENERATION); setGeneratedImages([]); setSelectedImage(null); setHasAttemptedFetch(false); setPage(1); }}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                            imageSource === ImageSource.AI_GENERATION
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <span>✨</span> AI 文生图 (推荐)
                        </button>
                        <button
                          onClick={() => { setImageSource(ImageSource.STOCK_LIBRARY); setGeneratedImages([]); setSelectedImage(null); setHasAttemptedFetch(false); setPage(1); }}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                            imageSource === ImageSource.STOCK_LIBRARY || imageSource === ImageSource.GOOGLE_SEARCH
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <span>🔍</span> 全网搜图
                        </button>
                     </div>

                     {/* Main Action Button - Hidden if images exist, use Refresh button instead? 
                         No, keep it for initial search or manual trigger 
                     */}
                     {generatedImages.length === 0 && (
                       <button 
                         onClick={() => handleFetchImages(false)}
                         disabled={selectedKeywords.length === 0 || isGeneratingImages}
                         className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                       >
                         {isGeneratingImages ? (
                           <>
                             <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                             {imageSource === ImageSource.AI_GENERATION ? 'AI 正在绘制风景...' : '正在全网搜索...'}
                           </>
                         ) : (
                           <>
                             🚀 开始{imageSource === ImageSource.AI_GENERATION ? '生成' : '搜索'}图片
                           </>
                         )}
                       </button>
                     )}
                   </div>
                   
                   {/* Results Grid */}
                   {generatedImages.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 animate-fade-in mb-8">
                        {generatedImages.map((img, idx) => (
                          <ImageCard 
                            key={img.id} 
                            img={img} 
                            index={idx}
                            isSelected={selectedImage === img.url}
                            onSelect={() => setSelectedImage(img.url)}
                          />
                        ))}
                      </div>
                   )}

                   {/* Loading State when refreshing (and images cleared) */}
                   {isGeneratingImages && generatedImages.length === 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-8">
                         {[1,2,3,4,5].map((i) => (
                           <div key={i} className="aspect-square bg-slate-100 rounded-lg animate-pulse"></div>
                         ))}
                      </div>
                   )}
                   
                   {/* Empty State / No Results */}
                   {!isGeneratingImages && hasAttemptedFetch && generatedImages.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 mb-8 animate-fade-in">
                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-3 text-slate-400">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                        <h3 className="text-slate-900 font-medium mb-1">未找到相关图片</h3>
                        <p className="text-slate-500 text-sm mb-4 max-w-xs text-center">
                           搜不到满意的图片？试试其他关键词，或者使用 AI 生成功能。
                        </p>
                        <button 
                             onClick={() => handleFetchImages(true)}
                             className="text-indigo-600 hover:text-indigo-800 font-medium"
                           >
                             🔄 重试 / 换一换
                        </button>
                     </div>
                   )}

                   {/* Editor Area - Shows automatically when image selected */}
                   {selectedImage && (
                     <ImageEditor imageUrl={selectedImage} />
                   )}
                </div>

              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
