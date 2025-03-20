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
