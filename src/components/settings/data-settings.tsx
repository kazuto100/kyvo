"use client";

import { Download, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadText, parseProductCSV, productsToCSV, PRODUCT_CSV_COLUMNS, toCSV } from "@/lib/csv";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { MasterData, Product } from "@/lib/types";

async function fetchAllProducts(): Promise<Product[]> {
  const supabase = createClient();
  const rows: Product[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("purchase_date", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data as Product[]));
    if (data.length < 1000) break;
  }
  return rows;
}

/** 名前 → id（無ければ作成） */
async function resolveIds(
  table: "brands" | "categories" | "suppliers",
  names: string[],
  existing: { id: string; name: string }[],
) {
  const map = new Map(existing.map((x) => [x.name, x.id]));
  const missing = [...new Set(names.filter((n) => n && !map.has(n)))];
  if (missing.length) {
    const { data, error } = await createClient()
      .from(table)
      .insert(missing.map((name) => ({ name })))
      .select("id, name");
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const r of data ?? []) map.set(r.name, r.id);
  }
  return map;
}

export function DataSettings({ master }: { master: MasterData }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  async function exportAll() {
    setBusy("export");
    try {
      const products = await fetchAllProducts();
      downloadText(`resell_products_${todayISO()}.csv`, productsToCSV(products, master));
      toast.success(`${products.length}件を書き出しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "書き出しに失敗しました");
    } finally {
      setBusy(null);
    }
  }

  function downloadTemplate() {
    downloadText(
      "resell_import_template.csv",
      toCSV([
        [...PRODUCT_CSV_COLUMNS],
        ["CASIO G-SHOCK GA-2100", "CASIO", "時計", "目立った傷や汚れなし", "セカンドストリート", "セカンドストリート多治見店", todayISO(), 5500, 0, "メルカリ", 12000, "", 750, "", 0, "", "", "出品中", "", "", "", ""],
      ]),
    );
  }

  async function importFile(file: File) {
    setBusy("import");
    try {
      const { rows, errors } = parseProductCSV(await file.text());
      if (rows.length === 0) throw new Error(errors[0] ?? "取り込める行がありません");
      const supabase = createClient();
      const [brands, categories, suppliers] = await Promise.all([
        resolveIds("brands", rows.map((r) => r.brand), master.brands),
        resolveIds("categories", rows.map((r) => r.category), master.categories),
        resolveIds("suppliers", rows.map((r) => r.supplier), master.suppliers),
      ]);
      // 店舗（仕入先と紐づけて作成）
      const storeMap = new Map(master.stores.map((s) => [s.name, s.id]));
      const newStores = [...new Map(rows.filter((r) => r.store && !storeMap.has(r.store)).map((r) => [r.store, r])).values()];
      if (newStores.length) {
        const { data, error } = await supabase
          .from("stores")
          .insert(newStores.map((r) => ({ name: r.store, supplier_id: suppliers.get(r.supplier) ?? null })))
          .select("id, name");
        if (error) throw new Error(`stores: ${error.message}`);
        for (const s of data ?? []) storeMap.set(s.name, s.id);
      }
      const platformMap = new Map(master.platforms.map((p) => [p.name, p.id]));
      const today = todayISO();
      const payload = rows.map((r) => ({
        name: r.name,
        brand_id: brands.get(r.brand) ?? null,
        category_id: categories.get(r.category) ?? null,
        condition: r.condition || null,
        supplier_id: suppliers.get(r.supplier) ?? null,
        purchase_store_id: storeMap.get(r.store) ?? null,
        purchase_date: r.purchase_date ?? today,
        purchase_price: r.purchase_price,
        other_purchase_cost: r.other_purchase_cost,
        selling_platform_id: platformMap.get(r.platform) ?? null,
        expected_sale_price: r.expected_sale_price,
        actual_sale_price: r.actual_sale_price,
        shipping_cost: r.shipping_cost,
        selling_fee_auto: r.selling_fee === null,
        selling_fee: r.selling_fee ?? 0,
        other_cost: r.other_cost,
        status: r.status,
        listing_date: r.listing_date,
        sold_date: r.sold_date,
        listing_url: r.listing_url,
        memo: r.memo,
      }));
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from("products").insert(payload.slice(i, i + 200));
        if (error) throw new Error(`${i + 2}行目付近: ${error.message}`);
      }
      toast.success(`${payload.length}件を取り込みました${errors.length ? `（${errors.length}行スキップ）` : ""}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取り込みに失敗しました");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" size="lg" onClick={exportAll} disabled={!!busy}>
          {busy === "export" ? <Loader2 className="animate-spin" /> : <Download />}
          全商品をCSVで書き出し
        </Button>
        <Button variant="outline" size="lg" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          {busy === "import" ? <Loader2 className="animate-spin" /> : <Upload />}
          CSVを取り込む
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        書き出したCSVと同じ列見出しで取り込めます（列の順番は自由・「商品名」以外は省略可）。
        <button type="button" className="ml-1 text-brand underline-offset-2 hover:underline" onClick={downloadTemplate}>
          テンプレートをダウンロード
        </button>
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
