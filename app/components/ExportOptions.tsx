"use client";

import { useState } from 'react';
import { OCRResponse } from "@mistralai/mistralai/src/models/components/ocrresponse.js";
import { extractResumeData } from '../action/dataExtractor';
import { generateResumeExcel } from '../action/excelGenerator';

type ExportOptionsProps = {
  ocrResult: OCRResponse | null;
};

export default function ExportOptions({ ocrResult }: ExportOptionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  
  const handleExportToExcel = async () => {
    if (!ocrResult) return;
    
    try {
      setIsExporting(true);
      setExportError(null);
      
      // OCRデータから履歴書情報を抽出
      const resumeData = await extractResumeData(ocrResult);
      
      // Excelファイルを生成
      const excelUrl = await generateResumeExcel(resumeData);
      
      // ダウンロードリンクを作成して自動クリック
      const link = document.createElement('a');
      link.href = excelUrl;
      link.download = `履歴書_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Excel export error:', error);
      setExportError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setIsExporting(false);
    }
  };
  
  if (!ocrResult) return null;
  
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
      <h3 className="text-lg font-medium mb-3">エクスポートオプション</h3>
      
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExportToExcel}
          disabled={isExporting}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              エクスポート中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Excelにエクスポート
            </>
          )}
        </button>
      </div>
      
      {exportError && (
        <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
          <p className="text-sm">{exportError}</p>
        </div>
      )}
    </div>
  );
}
