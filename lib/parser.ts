import { CategoryItem, BudgetBucket } from "./store";

export interface ParsedTransaction {
  title: string;
  amount: number;
  categoryId: string;
  bucket: BudgetBucket;
}

export function parseTransaction(input: string, categories: CategoryItem[]): ParsedTransaction[] {
  // pisah kalimat berdasarkan kata hubung
  const parts = input.split(/(?:\s+dan\s+|\s+sama\s+|\s+serta\s+|,|&)/i).filter(p => p.trim().length > 0);
  
  const results: ParsedTransaction[] = [];

  for (const part of parts) {
    let title = part.trim();
    let amount = 0;

    // regex buat cari nominal angka
    // match format angka plus singkatan rb/k/jt
    const amountRegex = /(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?/gi;
    let match;
    let foundAmountStr = "";
    
    // cari nominal terakhir di kalimat
    let lastMatch = null;
    while ((match = amountRegex.exec(part)) !== null) {
      lastMatch = match;
    }

    if (lastMatch) {
      let numStr = lastMatch[1].replace(/,/g, '.');
      let baseAmount = parseFloat(numStr);
      let suffix = lastMatch[2]?.toLowerCase();
      
      if (suffix) {
        if (["rb", "ribu", "k"].includes(suffix)) baseAmount *= 1000;
        if (["jt", "juta"].includes(suffix)) baseAmount *= 1000000;
      }
      
      amount = baseAmount;
      title = part.slice(0, lastMatch.index).trim() + " " + part.slice(lastMatch.index + lastMatch[0].length).trim();
      title = title.trim();
    }
    
    if (amount <= 0) continue; // skip kalau ga ada nominal
    if (!title) title = "Pengeluaran";

    // pencocokan kategori
    let bestMatchCategory = categories.find(c => c.name === "Kebutuhan Kuliah/Kerja") || categories[0]; // kategori default
    let maxMatches = 0;
    
    const titleWords = title.toLowerCase().split(/\s+/);
    for (const cat of categories) {
      let matchCount = 0;
      for (const kw of cat.keywords) {
        if (titleWords.some(w => w.includes(kw) || kw.includes(w))) {
          matchCount++;
        }
      }
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        bestMatchCategory = cat;
      }
    }
    
    // fallback ke kategori default kalo ga ada keyword yang cocok
    // cek basic keyword
    
    results.push({
      title,
      amount,
      categoryId: bestMatchCategory.id,
      bucket: bestMatchCategory.bucket,
    });
  }

  return results;
}
