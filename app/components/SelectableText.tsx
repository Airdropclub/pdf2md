"use client";

import { useState, useEffect } from 'react';
import { OCRResponse } from "@mistralai/mistralai/src/models/components/ocrresponse.js";
import { StoredOCRResult } from '../utils/storageUtils';

type SelectableTextProps = {
  ocrResult: OCRResponse | null;
  onTextSelect: (text: string) => void;
};

export default function SelectableText({ ocrResult, onTextSelect }: SelectableTextProps) {
  const [selectedText, setSelectedText] = useState<string>('');
  
  // テキスト選択時の処理
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString());
    }
  };
  
  // 選択したテキストを転記用に送信
  const handleUseSelectedText = () => {
    if (selectedText) {
      onTextSelect(selectedText);
      setSelectedText('');
    }
  };
  
  // マウスアップ時にテキスト選択を検知
  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
    };
  }, []);
  
  if (!ocrResult || !ocrResult.pages || ocrResult.pages.length === 0) {
    return null;
  }
  
  return (
    <div className="relative">
      {/* OCR結果の表示 */}
      <div className="ocr-content">
        {ocrResult.pages.map((page, pageIndex) => (
          <div key={pageIndex} className="mb-8 p-4 bg-white rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Page {page.index + 1}</h3>
            <div className="whitespace-pre-wrap text-gray-800 selectable-text">
              {page.markdown || "（テキストなし）"}
            </div>
          </div>
        ))}
      </div>
      
      {/* 選択テキスト表示エリア */}
      {selectedText && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-blue-200 max-w-md z-50">
          <h4 className="text-sm font-medium mb-2">選択したテキスト:</h4>
          <div className="text-sm bg-gray-50 p-2 rounded mb-2 max-h-32 overflow-y-auto">
            {selectedText}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleUseSelectedText}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              このテキストを使用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
