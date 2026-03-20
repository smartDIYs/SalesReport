// EC-CUBE売上レポートCSVとアプリの計算結果を比較するスクリプト
import fs from 'fs';
import iconv from 'iconv-lite';

// CSVファイルのパスと対象月を引数から取得
const csvPath = process.argv[2];
const targetYear = parseInt(process.argv[3], 10);
const targetMonth = parseInt(process.argv[4], 10);

if (!csvPath || !targetYear || !targetMonth) {
  console.log('使い方: node verify.js <CSVファイル> <年> <月>');
  console.log('例: node verify.js salesreport_product_20260312103837.csv 2026 2');
  process.exit(1);
}

// === カテゴリ定義（server.jsと同じ） ===
const CATEGORIES = [
  { key: 'co2-laser',      name: 'CO2レーザー加工機',   prefixes: ['EP', 'HL', 'LC', 'FC'] },
  { key: 'laser-marker',   name: 'レーザーマーカー',     prefixes: ['MC', 'MF', 'MM', 'MU', 'MP', 'LM', 'MR'] },
  { key: 'laser-welding',  name: 'レーザー溶接機',       prefixes: ['SL', 'SW'] },
  { key: 'sheet-metal',    name: '金属切断機',            prefixes: ['PL', 'FL'] },
  { key: 'laser-cleaner',  name: 'レーザークリーナー',   prefixes: ['SC'] },
  { key: 'laser-safety',   name: '保護具・安全対策',     prefixes: ['AE'] },
];

const SAFETY_KEYWORDS = ['保護メガネ', '保護めがね', 'パーテーション', '安全衛生', '保護パネル', 'カーテン', '標識シール'];

function isDiscontinuedProduct(productCode) {
  const code = (productCode || '').toUpperCase();
  const prefix = code.substring(0, 2);
  if (['EL', 'ES', 'FM', 'EA'].includes(prefix)) {
    if (/^ELB0[1-9]/.test(code)) return false;
    return true;
  }
  if (code.startsWith('MCN') || code.startsWith('CFD')) return true;
  if (/^LC13/.test(code)) return true;
  if (/^SCB01/.test(code)) return true;
  if (/^SCO/.test(code)) return true;
  return false;
}

function classifyProduct(productCode, productName) {
  const code = (productCode || '').toUpperCase();
  const name = productName || '';

  if (isDiscontinuedProduct(productCode)) {
    return { categoryKey: null, categoryName: null, type: 'option' };
  }

  if (/^ELB0[1-9]/.test(code)) {
    return { categoryKey: 'co2-laser', categoryName: 'CO2レーザー加工機', type: 'option' };
  }

  if (SAFETY_KEYWORDS.some((kw) => name.includes(kw))) {
    return { categoryKey: 'laser-safety', categoryName: '保護具・安全対策', type: 'option' };
  }

  const prefix = code.substring(0, 2);
  const category = CATEGORIES.find((c) => c.prefixes.includes(prefix));

  const isMainUnit = code.length >= 3 && (
    code[2] === 'A' ||
    (code[2] === 'B' && code.includes('-'))
  );
  const isWarranty = /延長保証/.test(name);

  return {
    categoryKey: category?.key ?? null,
    categoryName: category?.name ?? null,
    type: (isMainUnit || isWarranty) ? 'main' : 'option',
  };
}

// CSV読み込み（Shift-JIS対応）
const buf = fs.readFileSync(csvPath);
const csvText = iconv.decode(buf, 'Shift_JIS');
const lines = csvText.trim().split('\n');

// ヘッダー行をスキップ
const salesMap = new Map();
let uncategorizedTotal = 0;
let totalSales = 0;
const uncategorizedItems = [];

for (let i = 1; i < lines.length; i++) {
  // CSV解析（簡易、ダブルクォート対応）
  const match = lines[i].match(/^([^,]*),(".*?"|[^,]*),([^,]*),([^,]*),([^,]*)$/);
  if (!match) continue;

  const productCode = match[1].replace(/"/g, '').trim();
  const productName = match[2].replace(/"/g, '').trim();
  const quantity = parseInt(match[4], 10);
  const amount = parseInt(match[5], 10);

  const { categoryKey, categoryName, type } = classifyProduct(productCode, productName);
  totalSales += amount;

  if (!categoryKey) {
    uncategorizedTotal += amount;
    uncategorizedItems.push({ code: productCode || '(空)', name: productName, amount });
    continue;
  }

  const mapKey = `${categoryKey}:${type}`;
  if (salesMap.has(mapKey)) {
    const entry = salesMap.get(mapKey);
    entry.total += amount;
  } else {
    salesMap.set(mapKey, { categoryKey, categoryName, type, total: amount });
  }
}

// 結果表示
console.log(`\n=== ${targetYear}年${targetMonth}月 CSV検証結果 ===\n`);
console.log('カテゴリ'.padEnd(22) + '本体'.padStart(14) + 'オプション'.padStart(14) + '小計'.padStart(14));
console.log('-'.repeat(64));

let grandTotal = 0;
for (const cat of CATEGORIES) {
  const main = salesMap.get(`${cat.key}:main`)?.total ?? 0;
  const option = salesMap.get(`${cat.key}:option`)?.total ?? 0;
  const sub = main + option;
  if (sub === 0) continue;
  grandTotal += sub;
  console.log(
    cat.name.padEnd(20) +
    `¥${main.toLocaleString()}`.padStart(14) +
    `¥${option.toLocaleString()}`.padStart(14) +
    `¥${sub.toLocaleString()}`.padStart(14)
  );
}

console.log('-'.repeat(64));
console.log('合計'.padEnd(20) + ' '.repeat(28) + `¥${grandTotal.toLocaleString()}`.padStart(14));
console.log(`\n未分類合計: ¥${uncategorizedTotal.toLocaleString()}`);
console.log(`総合計: ¥${totalSales.toLocaleString()}`);

if (uncategorizedItems.length > 0) {
  console.log('\n--- 未分類の商品 ---');
  for (const item of uncategorizedItems) {
    console.log(`  ${item.code.padEnd(12)} ${item.name.substring(0, 30).padEnd(32)} ¥${item.amount.toLocaleString()}`);
  }
}
