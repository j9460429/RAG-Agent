import Link from "next/link";
import {
  Brain,
  MessageSquare,
  BookOpen,
  Search,
  PenTool,
  GitFork,
  Youtube,
  FileText,
  Sparkles,
  Rss,
  Globe,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    color: "text-blue-600",
    title: "Gemini 智慧對話",
    desc: "Gemini 3 Flash 即時串流回應，支援圖片辨識與思維鏈推理",
  },
  {
    icon: Search,
    color: "text-violet-600",
    title: "深度研究",
    desc: "多引擎並行研究，自動拆解問題、搜尋網路、生成完整報告",
  },
  {
    icon: BookOpen,
    color: "text-green-600",
    title: "RAG 知識庫",
    desc: "上傳 PDF、Word、Excel 等文件自動向量化，對話時檢索相關知識並標註來源",
  },
  {
    icon: Youtube,
    color: "text-red-600",
    title: "YouTube 知識匯入",
    desc: "貼上影片 URL 自動擷取字幕並生成 AI 摘要；訂閱頻道自動監控新影片",
  },
  {
    icon: FileText,
    color: "text-orange-600",
    title: "Word 報告生成",
    desc: "對話結束後一鍵生成結構化 Word 報告，支援自訂格式匯出",
  },
  {
    icon: Globe,
    color: "text-teal-600",
    title: "Google Drive 整合",
    desc: "直接匯入 Google Docs、Sheets、Slides，自動解析並加入知識庫",
  },
  {
    icon: Rss,
    color: "text-amber-600",
    title: "網頁 / RSS 監控",
    desc: "訂閱 RSS 或網頁，定期自動檢查並匯入新內容到知識庫",
  },
  {
    icon: PenTool,
    color: "text-pink-600",
    title: "Canvas 編輯器",
    desc: "Markdown 即時編輯與 AI 圖表生成，研究成果可視化",
  },
  {
    icon: GitFork,
    color: "text-cyan-600",
    title: "對話分支",
    desc: "任意節點建立對話分支，探索不同思路而不丟失原始脈絡",
  },
  {
    icon: Brain,
    color: "text-purple-600",
    title: "知識圖譜",
    desc: "視覺化知識節點關聯，用圖譜探索你的知識網路",
  },
  {
    icon: Sparkles,
    color: "text-indigo-600",
    title: "AI 角色商城",
    desc: "自訂或套用預設 AI 角色，為不同場景配置專屬的系統提示詞",
  },
  {
    icon: BarChart3,
    color: "text-sky-600",
    title: "專業報告",
    desc: "AI 自動產生多維度分析報告，涵蓋摘要、關鍵洞見與行動建議",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          NexusMind
        </h1>
        <p className="text-lg text-gray-500 max-w-lg mb-8">
          AI 驅動的知識研究平台 — 對話、研究、知識管理一站整合
        </p>
        <div className="flex gap-3">
          <Link
            href="/register"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            免費開始
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-foreground font-medium rounded-lg transition-colors"
          >
            登入
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 pb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="p-6 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <f.icon className={`w-8 h-8 ${f.color} mb-3`} />
            <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pb-8 text-center">
        <p className="text-xs text-gray-400">NexusMind V1.0</p>
      </div>
    </div>
  );
}
