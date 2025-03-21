"use client";

import { useState } from 'react';
import { OCRResponse } from "@mistralai/mistralai/src/models/components/ocrresponse.js";
import { extractResumeData } from '../action/dataExtractor';
import { StoredOCRResult } from '../utils/storageUtils';

type DataTransferProps = {
  ocrResult: OCRResponse | null;
  selectedText: string | null;
};

export default function DataTransfer({ ocrResult, selectedText }: DataTransferProps) {
  const [transferFields, setTransferFields] = useState<{[key: string]: string}>({
    name: '',
    nameKana: '',
    birthDate: '',
    gender: '',
    address: '',
    addressKana: '',
    postalCode: '',
    phoneNumber: '',
    email: '',
    // その他の必要なフィールド
  });
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<{[key: string]: boolean}>({});

  // フィールドをクリックしたときにアクティブにする
  const handleFieldClick = (fieldName: string) => {
    setActiveField(fieldName);
  };

  // 選択したテキストをアクティブなフィールドに転記する
  const handleTransferText = (text: string) => {
    if (activeField) {
      setTransferFields({
        ...transferFields,
        [activeField]: text
      });
      
      // コピー成功表示
      setIsCopied({
        ...isCopied,
        [activeField]: true
      });
      
      // 3秒後に成功表示を消す
      setTimeout(() => {
        setIsCopied({
          ...isCopied,
          [activeField]: false
        });
      }, 3000);
    }
  };

  // 自動抽出を実行する
  const handleAutoExtract = async () => {
    if (!ocrResult) return;
    
    try {
      const resumeData = await extractResumeData(ocrResult);
      
      // 抽出されたデータをフィールドに設定
      setTransferFields({
        name: resumeData.name || '',
        nameKana: resumeData.nameKana || '',
        birthDate: resumeData.birthDate || '',
        gender: resumeData.gender || '',
        address: resumeData.address || '',
        addressKana: resumeData.addressKana || '',
        postalCode: resumeData.postalCode || '',
        phoneNumber: resumeData.phoneNumber || '',
        email: resumeData.email || '',
        // その他の必要なフィールド
      });
    } catch (error) {
      console.error('自動抽出エラー:', error);
    }
  };

  // クリップボードにコピーする
  const handleCopyToClipboard = () => {
    const textToCopy = Object.entries(transferFields)
      .map(([key, value]) => `${getFieldLabel(key)}: ${value}`)
      .join('\n');
    
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        alert('すべてのデータをクリップボードにコピーしました');
      })
      .catch(err => {
        console.error('クリップボードへのコピーに失敗しました:', err);
      });
  };

  // フィールド名から表示用ラベルを取得
  const getFieldLabel = (fieldName: string): string => {
    const labels: {[key: string]: string} = {
      name: '氏名',
      nameKana: '氏名（カナ）',
      birthDate: '生年月日',
      gender: '性別',
      address: '住所',
      addressKana: '住所（カナ）',
      postalCode: '郵便番号',
      phoneNumber: '電話番号',
      email: 'メールアドレス',
      // その他の必要なフィールド
    };
    
    return labels[fieldName] || fieldName;
  };

  // 選択したテキストが変更されたときに処理
  if (selectedText && activeField) {
    handleTransferText(selectedText);
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">データ転記</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleAutoExtract}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            disabled={!ocrResult}
          >
            自動抽出
          </button>
          <button
            onClick={handleCopyToClipboard}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            すべてコピー
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(transferFields).map(([fieldName, value]) => (
          <div 
            key={fieldName}
            className={`border rounded p-2 cursor-pointer transition-colors ${
              activeField === fieldName ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => handleFieldClick(fieldName)}
          >
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-500">{getFieldLabel(fieldName)}</label>
              {isCopied[fieldName] && (
                <span className="text-xs text-green-600">転記完了</span>
              )}
            </div>
            <div className="min-h-[1.5rem]">{value}</div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>使い方: 転記したいフィールドをクリックして選択し、OCR結果から必要なテキストを選択してください。</p>
      </div>
    </div>
  );
}
