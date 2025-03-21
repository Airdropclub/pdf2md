"use client";

import { OCRResponse } from "@mistralai/mistralai/src/models/components/ocrresponse.js";

// OCR結果のストレージキー
const OCR_RESULTS_STORAGE_KEY = 'pdf2md_ocr_results';

// OCR結果に一意のIDを付与するための型
export interface StoredOCRResult {
  id: string;
  timestamp: number;
  filename: string;
  result: OCRResponse;
}

/**
 * OCR結果をlocalStorageに保存する
 */
export function saveOCRResult(result: OCRResponse, filename: string): StoredOCRResult {
  // 既存のOCR結果を取得
  const existingResults = getStoredOCRResults();
  
  // 新しいOCR結果を作成
  const newResult: StoredOCRResult = {
    id: generateUniqueId(),
    timestamp: Date.now(),
    filename,
    result
  };
  
  // 結果を追加して保存
  const updatedResults = [newResult, ...existingResults];
  
  // ストレージ容量を考慮して最大10件まで保存
  const limitedResults = updatedResults.slice(0, 10);
  
  // localStorageに保存
  try {
    localStorage.setItem(OCR_RESULTS_STORAGE_KEY, JSON.stringify(limitedResults));
  } catch (error) {
    console.error('OCR結果の保存に失敗しました:', error);
  }
  
  return newResult;
}

/**
 * 保存されたOCR結果の一覧を取得する
 */
export function getStoredOCRResults(): StoredOCRResult[] {
  try {
    const storedData = localStorage.getItem(OCR_RESULTS_STORAGE_KEY);
    if (!storedData) return [];
    
    return JSON.parse(storedData) as StoredOCRResult[];
  } catch (error) {
    console.error('保存されたOCR結果の取得に失敗しました:', error);
    return [];
  }
}

/**
 * 特定のIDのOCR結果を取得する
 */
export function getStoredOCRResultById(id: string): StoredOCRResult | null {
  const results = getStoredOCRResults();
  return results.find(result => result.id === id) || null;
}

/**
 * 特定のIDのOCR結果を削除する
 */
export function deleteStoredOCRResult(id: string): boolean {
  try {
    const results = getStoredOCRResults();
    const filteredResults = results.filter(result => result.id !== id);
    
    if (results.length === filteredResults.length) {
      return false; // 削除対象が見つからなかった
    }
    
    localStorage.setItem(OCR_RESULTS_STORAGE_KEY, JSON.stringify(filteredResults));
    return true;
  } catch (error) {
    console.error('OCR結果の削除に失敗しました:', error);
    return false;
  }
}

/**
 * すべてのOCR結果を削除する
 */
export function clearAllStoredOCRResults(): boolean {
  try {
    localStorage.removeItem(OCR_RESULTS_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('すべてのOCR結果の削除に失敗しました:', error);
    return false;
  }
}

/**
 * 一意のIDを生成する
 */
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
