# スプレッドシート連携機能の設計書

## 1. 概要

PDFファイルからOCRで抽出したデータを、指定された履歴書テンプレート（Excelファイル）に自動転記する機能を実装します。

## 2. 機能要件

1. OCRデータから履歴書に必要な情報を抽出する
2. 抽出した情報を構造化する
3. 構造化したデータを履歴書テンプレートの適切なセルに転記する
4. ユーザーインターフェースからエクスポート機能を利用できるようにする

## 3. 技術スタック

- **フロントエンド**: React, TypeScript
- **バックエンド**: Next.js (Server Actions)
- **Excel操作**: ExcelJS
- **データ処理**: 正規表現、自然言語処理

## 4. データフロー

1. ユーザーがPDFをアップロード
2. Mistral AI OCRでPDFからテキストを抽出
3. 抽出されたテキストから必要な情報を構造化
4. 構造化されたデータをExcelテンプレートに転記
5. 生成されたExcelファイルをユーザーにダウンロード提供

## 5. 主要コンポーネント設計

### 5.1 OCRデータ構造化モジュール

```typescript
// app/action/dataExtractor.ts
"use server";

import { OCRResponse } from "@mistralai/mistralai/src/models/components/ocrresponse.js";

export interface ExtractedResumeData {
  // 基本情報
  name?: string;
  nameKana?: string;
  birthDate?: string;
  gender?: string;
  age?: number;
  
  // 連絡先情報
  address?: string;
  addressKana?: string;
  postalCode?: string;
  phoneNumber?: string;
  email?: string;
  
  // 連絡先（現住所と異なる場合）
  alternativeAddress?: string;
  alternativeAddressKana?: string;
  alternativePhoneNumber?: string;
  
  // 学歴・職歴
  educationHistory?: Array<{year: string; month: string; description: string}>;
  workHistory?: Array<{year: string; month: string; description: string}>;
  
  // その他情報
  licenses?: Array<{year: string; month: string; description: string}>;
  healthCondition?: string;
  hobbies?: string;
  nearestStation?: string;
  dependents?: number;
  hasSpouse?: boolean;
  supportingSpouse?: boolean;
}

/**
 * OCRデータから履歴書情報を抽出する
 */
export async function extractResumeData(ocrResult: OCRResponse): Promise<ExtractedResumeData> {
  if (!ocrResult || !ocrResult.pages || ocrResult.pages.length === 0) {
    throw new Error("有効なOCR結果がありません");
  }
  
  // すべてのページのマークダウンを結合
  const allText = ocrResult.pages
    .map(page => page.markdown || "")
    .join("\n\n");
  
  // 抽出結果オブジェクト
  const extractedData: ExtractedResumeData = {};
  
  // 名前の抽出（「氏名」の後に続くテキスト）
  const nameMatch = allText.match(/氏名[：:]*\s*([^\n\r]+)/);
  if (nameMatch && nameMatch[1]) {
    extractedData.name = nameMatch[1].trim();
  }
  
  // フリガナの抽出
  const nameKanaMatch = allText.match(/ふりがな[：:]*\s*([^\n\r]+)/);
  if (nameKanaMatch && nameKanaMatch[1]) {
    extractedData.nameKana = nameKanaMatch[1].trim();
  }
  
  // 生年月日の抽出
  const birthDateMatch = allText.match(/生年月日[：:]*\s*([^\n\r（(]+)/);
  if (birthDateMatch && birthDateMatch[1]) {
    extractedData.birthDate = birthDateMatch[1].trim();
    
    // 年齢の抽出（生年月日の後の括弧内）
    const ageMatch = allText.match(/生年月日[：:]*\s*[^\n\r（(]+[（(]\s*満\s*(\d+)\s*歳/);
    if (ageMatch && ageMatch[1]) {
      extractedData.age = parseInt(ageMatch[1], 10);
    }
  }
  
  // 性別の抽出
  const genderMatch = allText.match(/性別[：:]*\s*([男女])/);
  if (genderMatch && genderMatch[1]) {
    extractedData.gender = genderMatch[1].trim();
  }
  
  // 住所の抽出
  const addressMatch = allText.match(/現住所[：:]*\s*([^\n\r]+)(?:\n|\r|$)/);
  if (addressMatch && addressMatch[1]) {
    extractedData.address = addressMatch[1].trim();
    
    // 郵便番号の抽出
    const postalCodeMatch = addressMatch[1].match(/〒\s*(\d{3}-\d{4})/);
    if (postalCodeMatch && postalCodeMatch[1]) {
      extractedData.postalCode = postalCodeMatch[1];
    }
  }
  
  // 電話番号の抽出
  const phoneMatch = allText.match(/電話番号[：:]*\s*([0-9\-]+)/);
  if (phoneMatch && phoneMatch[1]) {
    extractedData.phoneNumber = phoneMatch[1].trim();
  }
  
  // メールアドレスの抽出
  const emailMatch = allText.match(/E[-\s]?mail[：:]*\s*([^\s]+@[^\s]+)/);
  if (emailMatch && emailMatch[1]) {
    extractedData.email = emailMatch[1].trim();
  }
  
  // 学歴の抽出
  const educationSection = allText.match(/学歴\s*\n([\s\S]*?)(?:職歴|$)/);
  if (educationSection && educationSection[1]) {
    const educationText = educationSection[1];
    const educationEntries = educationText.match(/(\d+)\s*年\s*(\d+)\s*月\s*([^\n\r]+)/g);
    
    if (educationEntries) {
      extractedData.educationHistory = educationEntries.map(entry => {
        const parts = entry.match(/(\d+)\s*年\s*(\d+)\s*月\s*(.+)/);
        if (parts) {
          return {
            year: parts[1],
            month: parts[2],
            description: parts[3].trim()
          };
        }
        return { year: "", month: "", description: entry.trim() };
      });
    }
  }
  
  // 職歴の抽出
  const workSection = allText.match(/職歴\s*\n([\s\S]*?)(?:免許・資格|健康状態|趣味|$)/);
  if (workSection && workSection[1]) {
    const workText = workSection[1];
    const workEntries = workText.match(/(\d+)\s*年\s*(\d+)\s*月\s*([^\n\r]+)/g);
    
    if (workEntries) {
      extractedData.workHistory = workEntries.map(entry => {
        const parts = entry.match(/(\d+)\s*年\s*(\d+)\s*月\s*(.+)/);
        if (parts) {
          return {
            year: parts[1],
            month: parts[2],
            description: parts[3].trim()
          };
        }
        return { year: "", month: "", description: entry.trim() };
      });
    }
  }
  
  // 免許・資格の抽出
  const licenseSection = allText.match(/免許・資格\s*\n([\s\S]*?)(?:健康状態|趣味|$)/);
  if (licenseSection && licenseSection[1]) {
    const licenseText = licenseSection[1];
    const licenseEntries = licenseText.match(/(\d+)\s*年\s*(\d+)\s*月\s*([^\n\r]+)/g);
    
    if (licenseEntries) {
      extractedData.licenses = licenseEntries.map(entry => {
        const parts = entry.match(/(\d+)\s*年\s*(\d+)\s*月\s*(.+)/);
        if (parts) {
          return {
            year: parts[1],
            month: parts[2],
            description: parts[3].trim()
          };
        }
        return { year: "", month: "", description: entry.trim() };
      });
    }
  }
  
  // 健康状態の抽出
  const healthMatch = allText.match(/健康状態[：:]*\s*([^\n\r]+)/);
  if (healthMatch && healthMatch[1]) {
    extractedData.healthCondition = healthMatch[1].trim();
  }
  
  // 趣味・特技の抽出
  const hobbiesMatch = allText.match(/趣味・特技[：:]*\s*([^\n\r]+)/);
  if (hobbiesMatch && hobbiesMatch[1]) {
    extractedData.hobbies = hobbiesMatch[1].trim();
  }
  
  // 最寄り駅の抽出
  const stationMatch = allText.match(/最寄り駅[：:]*\s*([^\n\r]+)/);
  if (stationMatch && stationMatch[1]) {
    extractedData.nearestStation = stationMatch[1].trim();
  }
  
  // 扶養家族数の抽出
  const dependentsMatch = allText.match(/扶養家族数[（(]配偶者を除く[）)][：:]*\s*(\d+)/);
  if (dependentsMatch && dependentsMatch[1]) {
    extractedData.dependents = parseInt(dependentsMatch[1], 10);
  }
  
  // 配偶者の有無
  const spouseMatch = allText.match(/配偶者の有無[：:]*\s*([あり|なし]+)/);
  if (spouseMatch && spouseMatch[1]) {
    extractedData.hasSpouse = spouseMatch[1].includes("あり");
  }
  
  // 配偶者の扶養義務
  const supportingSpouseMatch = allText.match(/配偶者の扶養義務[：:]*\s*([あり|なし]+)/);
  if (supportingSpouseMatch && supportingSpouseMatch[1]) {
    extractedData.supportingSpouse = supportingSpouseMatch[1].includes("あり");
  }
  
  return extractedData;
}
```

### 5.2 Excelファイル生成モジュール

```typescript
// app/action/excelGenerator.ts
"use server";

import ExcelJS from 'exceljs';
import { ExtractedResumeData } from './dataExtractor';
import { put } from '@vercel/blob';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * 履歴書データをExcelテンプレートに転記する
 */
export async function generateResumeExcel(
  resumeData: ExtractedResumeData,
  templatePath?: string
): Promise<string> {
  // テンプレートパスが指定されていない場合はデフォルトテンプレートを使用
  const defaultTemplatePath = path.join(process.cwd(), 'public', 'templates', 'resume_template.xlsx');
  const templateFile = templatePath || defaultTemplatePath;
  
  // 一時ファイルパスの生成
  const tempDir = os.tmpdir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(tempDir, `resume_${timestamp}.xlsx`);
  
  // Excelワークブックの読み込み
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templateFile);
  
  // シートの取得
  const worksheet = workbook.getWorksheet('Sheet1');
  if (!worksheet) {
    throw new Error('テンプレートにSheet1が見つかりません');
  }
  
  // 基本情報の転記
  if (resumeData.name) {
    worksheet.getCell('B3').value = resumeData.name;
  }
  
  if (resumeData.nameKana) {
    worksheet.getCell('B2').value = resumeData.nameKana;
  }
  
  // 生年月日の転記（年、月、日に分割）
  if (resumeData.birthDate) {
    const birthDateMatch = resumeData.birthDate.match(/(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);
    if (birthDateMatch) {
      worksheet.getCell('A5').value = `${birthDateMatch[1]}年 ${birthDateMatch[2]}月 ${birthDateMatch[3]}日生 （ 満 ${resumeData.age || ''}歳 ）`;
    } else {
      worksheet.getCell('A5').value = resumeData.birthDate;
    }
  }
  
  // 性別の転記
  if (resumeData.gender) {
    worksheet.getCell('D2').value = resumeData.gender;
  }
  
  // 住所情報の転記
  if (resumeData.addressKana) {
    worksheet.getCell('B6').value = resumeData.addressKana;
  }
  
  if (resumeData.postalCode) {
    worksheet.getCell('B7').value = `〒 ${resumeData.postalCode}`;
  }
  
  if (resumeData.address) {
    // 郵便番号を除いた住所を設定
    const addressWithoutPostal = resumeData.address.replace(/〒\s*\d{3}-\d{4}\s*/, '');
    worksheet.getCell('A7').value = addressWithoutPostal;
  }
  
  // 連絡先情報の転記
  if (resumeData.phoneNumber) {
    worksheet.getCell('F6').value = resumeData.phoneNumber;
  }
  
  if (resumeData.email) {
    worksheet.getCell('F7').value = resumeData.email;
  }
  
  // 学歴の転記
  if (resumeData.educationHistory && resumeData.educationHistory.length > 0) {
    let rowIndex = 14; // 学歴の開始行
    
    resumeData.educationHistory.forEach(entry => {
      worksheet.getCell(`A${rowIndex}`).value = entry.year;
      worksheet.getCell(`B${rowIndex}`).value = entry.month;
      worksheet.getCell(`C${rowIndex}`).value = entry.description;
      rowIndex++;
    });
  }
  
  // 職歴の転記
  if (resumeData.workHistory && resumeData.workHistory.length > 0) {
    let rowIndex = 20; // 職歴の開始行
    
    resumeData.workHistory.forEach(entry => {
      worksheet.getCell(`A${rowIndex}`).value = entry.year;
      worksheet.getCell(`B${rowIndex}`).value = entry.month;
      worksheet.getCell(`C${rowIndex}`).value = entry.description;
      rowIndex++;
    });
  }
  
  // 免許・資格の転記
  if (resumeData.licenses && resumeData.licenses.length > 0) {
    let rowIndex = 14; // 免許・資格の開始行（右側）
    
    resumeData.licenses.forEach(entry => {
      worksheet.getCell(`I${rowIndex}`).value = entry.year;
      worksheet.getCell(`J${rowIndex}`).value = entry.month;
      worksheet.getCell(`K${rowIndex}`).value = entry.description;
      rowIndex++;
    });
  }
  
  // その他情報の転記
  if (resumeData.healthCondition) {
    worksheet.getCell('I17').value = resumeData.healthCondition;
  }
  
  if (resumeData.hobbies) {
    worksheet.getCell('I18').value = resumeData.hobbies;
  }
  
  if (resumeData.nearestStation) {
    worksheet.getCell('I19').value = resumeData.nearestStation;
  }
  
  if (resumeData.dependents !== undefined) {
    worksheet.getCell('L17').value = resumeData.dependents;
  }
  
  if (resumeData.hasSpouse !== undefined) {
    worksheet.getCell('L18').value = resumeData.hasSpouse ? 'あり' : 'なし';
  }
  
  if (resumeData.supportingSpouse !== undefined) {
    worksheet.getCell('L19').value = resumeData.supportingSpouse ? 'あり' : 'なし';
  }
  
  // ファイルの保存
  await workbook.xlsx.writeFile(outputPath);
  
  // Vercel Blobにアップロード
  const file = await fs.promises.readFile(outputPath);
  const blob = await put(`resumes/${path.basename(outputPath)}`, file, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  
  // 一時ファイルの削除
  await fs.promises.unlink(outputPath);
  
  return blob.url;
}
```

### 5.3 UIコンポーネント

```tsx
// app/components/ExportOptions.tsx
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
```

### 5.4 OcrResultViewコンポーネントの拡張

```tsx
// app/components/OcrResultView.tsx の修正部分

// 既存のインポートに追加
import ExportOptions from './ExportOptions';

// コンポーネントのreturn部分に追加
return (
  <div className="rounded-lg overflow-hidden border border-gray-200 h-full flex flex-col">
    {/* 既存のコード */}
    
    {/* エクスポートオプションの追加 */}
    <ExportOptions ocrResult={ocrResult} />
    
    {/* 既存のコード */}
  </div>
);
```

## 6. 必要なライブラリ

- **ExcelJS**: Excelファイルの生成と操作
- **file-saver**: クライアント側でのファイルダウンロード

```bash
npm install exceljs file-saver
npm install @types/file-saver --save-dev
```

## 7. テンプレート管理

1. デフォルトテンプレートを `public/templates/resume_template.xlsx` に配置
2. 将来的に複数テンプレートに対応する場合は、テンプレート選択UIを追加

## 8. エラーハンドリング

1. OCRデータが不十分な場合のエラーメッセージ
2. テンプレートが見つからない場合のフォールバック
3. Excel生成中のエラー処理
4. ダウンロード失敗時のリトライ機能

## 9. 将来の拡張性

1. 複数テンプレートのサポート
2. テンプレートのカスタマイズ機能
3. Google Sheetsへの直接エクスポート
4. データ抽出精度の向上（機械学習モデルの活用）

## 10. 実装スケジュール

1. 必要なライブラリのインストール
2. OCRデータ構造化モジュールの実装
3. Excelファイル生成モジュールの実装
4. UIコンポーネントの実装
5. 統合テスト
6. エラーハンドリングの改善
7. ドキュメント作成
