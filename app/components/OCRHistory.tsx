"use client";

import { useState, useEffect } from 'react';
import { StoredOCRResult, getStoredOCRResults, deleteStoredOCRResult } from '../utils/storageUtils';

type OCRHistoryProps = {
  onSelectResult: (result: StoredOCRResult) => void;
};

export default function OCRHistory({ onSelectResult }: OCRHistoryProps) {
  const [storedResults, setStoredResults] = useState<StoredOCRResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // コンポーネントマウント時に保存されたOCR結果を読み込む
  useEffect(() => {
    const loadStoredResults = () => {
      const results = getStoredOCRResults();
      setStoredResults(results);
    };

    loadStoredResults();
    
    // localStorageの変更を監視
    const handleStorageChange = () => {
      loadStoredResults();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 結果を削除する
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('この解析結果を削除してもよろしいですか？')) {
      deleteStoredOCRResult(id);
      setStoredResults(storedResults.filter(result => result.id !== id));
    }
  };

  // 日付をフォーマットする
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (storedResults.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        過去のOCR結果 ({storedResults.length})
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-md shadow-lg z-50 border border-gray-200">
          <div className="p-2 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">保存されたOCR結果</h3>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {storedResults.map((item) => (
              <li
                key={item.id}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex justify-between items-center"
                onClick={() => {
                  onSelectResult(item);
                  setIsOpen(false);
                }}
              >
                <div>
                  <div className="font-medium text-sm truncate max-w-[200px]">{item.filename}</div>
                  <div className="text-xs text-gray-500">{formatDate(item.timestamp)}</div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, item.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="削除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
