"use client";

import { OCRResponse } from "@mistralai/mistralai/src/models/components/ocrresponse.js";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";
import { useState, useRef, useEffect } from "react";
import { Copy, Check, Download } from "lucide-react";
import { downloadAsZip } from "../action/downloadHelper";
import ExportOptions from "./ExportOptions";

type OcrResultViewProps = {
  ocrResult: OCRResponse | { success: false; error: string } | null;
  analyzing: boolean;
};

export default function OcrResultView({ ocrResult, analyzing }: OcrResultViewProps) {
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [copyingAll, setCopyingAll] = useState(false);
  const [copyingPage, setCopyingPage] = useState<number | null>(null);
  const [pageInputValue, setPageInputValue] = useState<string>("");
  const [isInputError, setIsInputError] = useState(false);
  const [currentPageDisplay, setCurrentPageDisplay] = useState<string>("1");
  const [isDownloading, setIsDownloading] = useState(false);

  // クリップボードにコピーする関数
  const copyToClipboard = async (text: string, pageIndex?: number | null) => {
    try {
      await navigator.clipboard.writeText(text);

      if (pageIndex === null) {
        // すべてコピーの場合
        setCopyingAll(true);
        setTimeout(() => {
          setCopyingAll(false);
        }, 3000);
      } else if (pageIndex !== undefined) {
        // 個別ページコピーの場合
        setCopyingPage(pageIndex);
        setTimeout(() => {
          setCopyingPage(null);
        }, 3000);
      }
    } catch (err) {
      console.error("Copy failed:", err);
      setTimeout(() => {
        // エラー状態をリセット
      }, 3000);
    }
  };

  // すべてのページのマークダウンを結合してコピーする関数
  const copyAllMarkdown = () => {
    if (!ocrResult || "error" in ocrResult || !ocrResult.pages) return;

    const allMarkdown = ocrResult.pages
      .map((page) => {
        const pageTitle = `# Page ${page.index + 1}\n\n`;
        return pageTitle + (page.markdown || "（テキストなし）");
      })
      .join("\n\n---\n\n");

    copyToClipboard(allMarkdown, null);
  };

  // ZIPファイルとしてダウンロードする関数
  const handleDownloadZip = async () => {
    if (!ocrResult || "error" in ocrResult || !ocrResult.pages) return;

    try {
      setIsDownloading(true);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
      await downloadAsZip(ocrResult, `ocr-export-${timestamp}`);
    } catch (error) {
      console.error("ZIP download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  // マークダウンのみをダウンロードする関数
  const handleDownloadMarkdown = async () => {
    if (!ocrResult || "error" in ocrResult || !ocrResult.pages) return;

    try {
      setIsDownloading(true);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
      await downloadAsZip(ocrResult, `ocr-markdown-${timestamp}`, true);
    } catch (error) {
      console.error("Markdown download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  // スクロール時に表示中のページを検出
  useEffect(() => {
    if (!ocrResult || "error" in ocrResult || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageIndex = Number(entry.target.getAttribute("data-page-index"));
          if (entry.isIntersecting) {
            setVisiblePages((prev) =>
              prev.includes(pageIndex) ? prev : [...prev, pageIndex].sort((a, b) => a - b)
            );
          } else {
            setVisiblePages((prev) => prev.filter((idx) => idx !== pageIndex));
          }
        });
      },
      { root: containerRef.current, threshold: 0.1 }
    );

    // ページ要素を監視
    Object.entries(pageRefs.current).forEach(([, ref]) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [ocrResult]);

  // 表示中のページが変わったら現在のページ表示を更新
  useEffect(() => {
    if (visiblePages.length > 0) {
      setCurrentPageDisplay(String(visiblePages[0] + 1));
    }
  }, [visiblePages]);

  if (analyzing) {
    return (
      <div className="mt-4 p-5 bg-gray-50 text-gray-800 rounded-md flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-gray-600 mx-auto mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-800 font-medium">Analyzing PDF. Please wait...</p>
          <p className="text-gray-600 text-sm mt-1">Identifying document structure and images</p>
        </div>
      </div>
    );
  }

  if (!ocrResult) return null;

  // エラーオブジェクトかどうかをチェック
  if ("error" in ocrResult) {
    return (
      <div className="p-5 bg-red-50 text-red-800 rounded-md border border-red-200">
        <h3 className="font-bold text-lg mb-2">Analysis Error</h3>
        <p className="text-red-700">{ocrResult.error}</p>
        <div className="mt-3 text-sm">
          <p className="text-red-600">Please try another PDF or contact support for assistance.</p>
        </div>
      </div>
    );
  }

  // ページが存在しない場合
  if (!ocrResult.pages || ocrResult.pages.length === 0) {
    return (
      <div className="p-5 rounded-md bg-yellow-50 border border-yellow-200">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-yellow-500 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-yellow-700 font-medium">No page data found. Please try another PDF.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 h-full flex flex-col">
      {/* ヘッダー部分 */}
      <div className="bg-white border-b p-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        {/* タイトル部分 */}
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">OCR Analysis Results</h2>
        </div>

        {/* ページ入力フィールド */}
        <div className="relative flex items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // フォーム送信時のロジックは残しておく（バックアップとして）
              const pageNum = parseInt(pageInputValue);
              if (pageNum >= 1 && pageNum <= ocrResult.pages.length) {
                // ページ番号は1から始まるが、インデックスは0から始まるため調整
                const pageIndex = pageNum - 1;
                const pageElement = pageRefs.current[pageIndex];
                if (pageElement && containerRef.current) {
                  const containerRect = containerRef.current.getBoundingClientRect();
                  const pageRect = pageElement.getBoundingClientRect();
                  const relativeTop =
                    pageRect.top - containerRect.top + containerRef.current.scrollTop;
                  containerRef.current.scrollTo({
                    top: relativeTop,
                    behavior: "smooth",
                  });
                  setIsInputError(false);
                }
              } else {
                setIsInputError(true);
                setTimeout(() => setIsInputError(false), 2000);
              }
              setPageInputValue(""); // 入力をクリア
            }}
            className="flex items-center"
          >
            <input
              type="text"
              min="1"
              max={ocrResult.pages.length}
              value={pageInputValue || currentPageDisplay}
              onChange={(e) => setPageInputValue(e.target.value)}
              onClick={(e) => {
                // クリック時に全選択する
                e.currentTarget.select();
              }}
              onFocus={(e) => {
                // フォーカス時に全選択する
                e.currentTarget.select();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const input = e.currentTarget;
                  const oldBg = input.style.backgroundColor;
                  input.style.backgroundColor = "rgba(209, 250, 229, 0.8)"; // 一時的に背景色を変更（薄い緑色）
                  setTimeout(() => {
                    input.style.backgroundColor = oldBg;
                  }, 300);

                  // ページ移動のロジックを直接実行
                  const pageNum = parseInt(pageInputValue || currentPageDisplay);
                  if (pageNum >= 1 && pageNum <= ocrResult.pages.length) {
                    // ページ番号は1から始まるが、インデックスは0から始まるため調整
                    const pageIndex = pageNum - 1;
                    const pageElement = pageRefs.current[pageIndex];
                    if (pageElement && containerRef.current) {
                      const containerRect = containerRef.current.getBoundingClientRect();
                      const pageRect = pageElement.getBoundingClientRect();
                      const relativeTop =
                        pageRect.top - containerRect.top + containerRef.current.scrollTop;
                      containerRef.current.scrollTo({
                        top: relativeTop,
                        behavior: "smooth",
                      });
                      setIsInputError(false);
                    }
                  } else {
                    setIsInputError(true);
                    setTimeout(() => setIsInputError(false), 2000);
                  }
                  setPageInputValue(""); // 入力をクリア
                }
              }}
              className={`w-16 text-center border rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isInputError ? "border-red-500 bg-red-50" : "border-gray-300"
              }`}
              aria-label="Page number"
            />
            <span className="mx-1 text-gray-600">/</span>
            <span className="text-gray-600">{ocrResult.pages.length}</span>
          </form>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="bg-gray-50 border-b p-3 flex flex-wrap gap-2">
        <button
          onClick={copyAllMarkdown}
          disabled={copyingAll}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded flex items-center text-sm"
        >
          {copyingAll ? (
            <>
              <Check className="h-4 w-4 mr-1.5 text-green-600" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1.5" />
              <span>Copy All</span>
            </>
          )}
        </button>

        <button
          onClick={handleDownloadMarkdown}
          disabled={isDownloading}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded flex items-center text-sm"
        >
          <Download className="h-4 w-4 mr-1.5" />
          <span>Markdown</span>
        </button>

        <button
          onClick={handleDownloadZip}
          disabled={isDownloading}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded flex items-center text-sm"
        >
          <Download className="h-4 w-4 mr-1.5" />
          <span>ZIP (MD+Images)</span>
        </button>
      </div>

      {/* スプレッドシートエクスポートオプション */}
      <ExportOptions ocrResult={ocrResult} />

      {/* コンテンツ部分 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 bg-gray-50"
        style={{ scrollBehavior: "smooth" }}
      >
        {ocrResult.pages.map((page, pageIdx) => (
          <div
            key={`page-${pageIdx}`}
            ref={(el) => (pageRefs.current[pageIdx] = el)}
            data-page-index={pageIdx}
            className="mb-8 last:mb-0"
          >
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* ページヘッダー */}
              <div className="bg-gray-50 border-b px-4 py-2 flex justify-between items-center">
                <h3 className="text-gray-700 font-medium">Page {pageIdx + 1}</h3>
                <button
                  onClick={() => {
                    if (page.markdown) {
                      copyToClipboard(page.markdown, pageIdx);
                    }
                  }}
                  disabled={!page.markdown || copyingPage === pageIdx}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center"
                >
                  {copyingPage === pageIdx ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* マークダウンコンテンツ */}
              <div className="p-4 prose prose-sm max-w-none">
                {page.markdown ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      pre: ({ ...props }) => {
                        const match = props.children?.[0]?.props?.className?.includes("language-");
                        return (
                          <div
                            className={`my-2 overflow-auto rounded-md ${
                              match ? "bg-gray-800" : "bg-gray-100"
                            }`}
                          >
                            <pre
                              {...props}
                              className={`p-4 ${match ? "text-gray-100" : "text-gray-800"}`}
                            />
                          </div>
                        );
                      },
                      code: ({ inline, className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        ) : (
                          <code
                            className="px-1.5 py-0.5 mx-0.5 bg-gray-100 rounded text-gray-800 text-sm"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      img: ({ src, alt }) => {
                        // Base64画像の場合
                        if (src && src.startsWith("data:")) {
                          const base64Src = src;
                          return (
                            <img
                              src={base64Src}
                              alt={alt || ""}
                              className="max-w-full h-auto rounded shadow-sm my-3 mx-auto block"
                            />
                          );
                        }
                        // 通常の画像の場合
                        return (
                          <img
                            src={src || ""}
                            alt={alt || ""}
                            className="max-w-full h-auto rounded shadow-sm my-3 mx-auto block"
                          />
                        );
                      },
                    }}
                  >
                    {page.markdown}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-500 italic">No text content in this page.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
