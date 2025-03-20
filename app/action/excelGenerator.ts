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
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    access: 'public'
  });
  
  // 一時ファイルの削除
  await fs.promises.unlink(outputPath);
  
  return blob.url;
}
