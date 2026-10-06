// CSV 入出力（Excel で開けるよう BOM 付き UTF-8）
import { STATUS_META } from "./constants";
import { PRODUCT_STATUSES, type MasterData, type Product, type ProductStatus } from "./types";

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
}

/** RFC 4180 準拠の簡易パーサ */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// 列定義（エクスポートとインポートで共通）
export const PRODUCT_CSV_COLUMNS = [
  "商品名",
  "ブランド",
  "カテゴリ",
  "商品状態",
  "仕入先",
  "仕入店舗",
  "仕入日",
  "仕入価格",
  "その他仕入経費",
  "販売先",
  "想定販売価格",
  "販売価格",
  "送料",
  "販売手数料",
  "その他経費",
  "利益",
  "利益率",
  "ステータス",
  "出品日",
  "販売日",
  "出品URL",
  "メモ",
] as const;

export function productsToCSV(products: Product[], master: MasterData): string {
  const name = <T extends { id: string; name: string }>(list: T[], id: string | null) =>
    list.find((x) => x.id === id)?.name ?? "";
  return toCSV([
    [...PRODUCT_CSV_COLUMNS],
    ...products.map((p) => [
      p.name,
      name(master.brands, p.brand_id),
      name(master.categories, p.category_id),
      p.condition,
      name(master.suppliers, p.supplier_id),
      name(master.stores, p.purchase_store_id),
      p.purchase_date,
      p.purchase_price,
      p.other_purchase_cost,
      name(master.platforms, p.selling_platform_id),
      p.expected_sale_price,
      p.actual_sale_price,
      p.shipping_cost,
      p.selling_fee,
      p.other_cost,
      p.profit,
      p.profit_margin,
      STATUS_META[p.status].label,
      p.listing_date,
      p.sold_date,
      p.listing_url,
      p.memo,
    ]),
  ]);
}

export type ImportedRow = {
  name: string;
  brand: string;
  category: string;
  condition: string;
  supplier: string;
  store: string;
  purchase_date: string | null;
  purchase_price: number;
  other_purchase_cost: number;
  platform: string;
  expected_sale_price: number | null;
  actual_sale_price: number | null;
  shipping_cost: number;
  selling_fee: number | null;
  other_cost: number;
  status: ProductStatus;
  listing_date: string | null;
  sold_date: string | null;
  listing_url: string | null;
  memo: string | null;
};

const toInt = (v: string | undefined) => {
  const n = Number.parseInt((v ?? "").replace(/[,¥￥\s]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};
const toDate = (v: string | undefined) => {
  const m = (v ?? "").trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
};
const toStatus = (v: string | undefined): ProductStatus => {
  const s = (v ?? "").trim();
  return (
    PRODUCT_STATUSES.find((k) => k === s || STATUS_META[k].label === s) ?? "purchased"
  );
};

/** エクスポートと同じ列見出しの CSV を読み込む（列順は自由） */
export function parseProductCSV(text: string): { rows: ImportedRow[]; errors: string[] } {
  const [header, ...body] = parseCSV(text);
  const errors: string[] = [];
  if (!header) return { rows: [], errors: ["CSV が空です"] };
  const idx = (col: string) => header.findIndex((h) => h.trim() === col);
  if (idx("商品名") < 0) return { rows: [], errors: ["「商品名」列が見つかりません"] };
  const get = (r: string[], col: string) => {
    const i = idx(col);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  const rows: ImportedRow[] = [];
  body.forEach((r, i) => {
    const name = get(r, "商品名");
    if (!name) {
      errors.push(`${i + 2}行目: 商品名が空のためスキップ`);
      return;
    }
    rows.push({
      name: name.slice(0, 200),
      brand: get(r, "ブランド"),
      category: get(r, "カテゴリ"),
      condition: get(r, "商品状態"),
      supplier: get(r, "仕入先"),
      store: get(r, "仕入店舗"),
      purchase_date: toDate(get(r, "仕入日")),
      purchase_price: Math.max(0, toInt(get(r, "仕入価格")) ?? 0),
      other_purchase_cost: Math.max(0, toInt(get(r, "その他仕入経費")) ?? 0),
      platform: get(r, "販売先"),
      expected_sale_price: toInt(get(r, "想定販売価格")),
      actual_sale_price: toInt(get(r, "販売価格")),
      shipping_cost: Math.max(0, toInt(get(r, "送料")) ?? 0),
      selling_fee: toInt(get(r, "販売手数料")),
      other_cost: Math.max(0, toInt(get(r, "その他経費")) ?? 0),
      status: toStatus(get(r, "ステータス")),
      listing_date: toDate(get(r, "出品日")),
      sold_date: toDate(get(r, "販売日")),
      listing_url: /^https?:\/\//i.test(get(r, "出品URL")) ? get(r, "出品URL") : null,
      memo: get(r, "メモ") || null,
    });
  });
  return { rows, errors };
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
