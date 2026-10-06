// E2E: 登録 → 利益計算 → 判定 → 保存 → 一覧 → 売却 → 月間利益 → 達成率（スマホ幅）
// 使い方は e2e/README.md を参照
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const SHOTS = process.env.E2E_SCREENSHOT_DIR || "e2e/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const email = `e2e${Date.now()}@example.com`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ja-JP", timezoneId: "Asia/Tokyo" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  const text = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, " ");
  const step = (s) => console.log("▶", s);

  step("signup");
  await page.goto(`${BASE}/signup`);
  await shot("01-signup");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  await page.getByText("まだ商品がありません").waitFor();
  await shot("02-dashboard-empty");

  step("simulator: 20,000 / 8,000 / 750 / メルカリ10%");
  await page.goto(`${BASE}/simulator`);
  await page.fill("#q-purchase", "8000");
  await page.fill("#q-sale", "20000");
  await page.getByRole("button", { name: /60サイズ/ }).click();
  const main = await text("main");
  assert.match(main, /¥9,250/);
  assert.match(main, /46\.25%/);
  assert.match(main, /¥12,250/, "max purchase price");
  assert.match(main, /仕入れおすすめ/);
  await shot("03-simulator");

  step("simulator: 見送り判定");
  await page.fill("#q-purchase", "17000");
  assert.match(await text("main"), /見送り/);
  assert.match(await text("main"), /オーバー/);

  step("product registration (詳細)");
  await page.goto(`${BASE}/products/new`);
  await page.fill("#name", "SONY α6400 ボディ");
  await page.fill("#brand", "SONY");
  await page.selectOption("#category", { label: "カメラ" });
  await page.fill("#purchase_price", "8000");
  await page.selectOption("#supplier", { label: "セカンドストリート" });
  await page.selectOption("#store", "__new__");
  await page.fill("#new_store", "セカンドストリート多治見店");
  await page.fill("#expected_sale_price", "20000");
  await page.getByRole("button", { name: /60サイズ/ }).first().click();
  const bar = await text("form .fixed");
  assert.match(bar, /¥9,250/);
  assert.match(bar, /46\.3%/);
  await shot("04-product-form");
  await page.getByRole("button", { name: "登録する" }).click();
  await page.waitForURL(/\/products\/[0-9a-f-]{36}$/);
  await page.getByText("見込み利益").waitFor();
  let detail = await text("main");
  assert.match(detail, /¥9,250/, "DB computed profit");
  assert.match(detail, /46\.25%/);
  assert.match(detail, /SONY/);
  assert.match(detail, /セカンドストリート多治見店/);
  await shot("05-product-detail");
  const productUrl = page.url();

  step("sell registration");
  await page.getByRole("button", { name: "売却を登録" }).click();
  await page.locator("#sell-price").fill("22000");
  const dlg = await text("[role=dialog]");
  assert.match(dlg, /¥11,050/, "22000-8000-750-2200");
  await shot("06-sell-dialog");
  await page.getByRole("button", { name: "売却を登録する" }).click();
  await page.getByText("利益（確定）").waitFor();
  detail = await text("main");
  assert.match(detail, /¥11,050/);
  assert.match(detail, /売却済み/);

  step("dashboard reflects month profit & goal");
  await page.goto(`${BASE}/`);
  await page.getByText("今月の実績").waitFor();
  let dash = await text("main");
  assert.match(dash, /¥11,050/);
  assert.match(dash, /1\.1%/, "achievement 11050/1,000,000");
  assert.match(dash, /¥988,950/, "remaining");
  assert.match(dash, /あと90商品/, "988950/11050 → 90");
  assert.match(dash, /今日 \+¥11,050/);
  await shot("07-dashboard");

  step("quick purchase");
  await page.goto(`${BASE}/products/quick`);
  await page.fill("#q-name", "CASIO G-SHOCK GA-2100");
  await page.fill("#q-purchase", "5500");
  await page.fill("#q-sale", "12000");
  await page.getByRole("button", { name: /ネコポス/ }).click();
  await page.getByRole("button", { name: "仕入れ登録" }).click();
  await page.getByText("登録しました").waitFor();
  const res = await text("[role=dialog]");
  assert.match(res, /¥5,090/, "12000-5500-210-1200");
  await shot("08-quick-result");
  await page.getByRole("button", { name: "続けて登録" }).click();

  step("product list: search / filter / sort");
  await page.goto(`${BASE}/products`);
  await page.getByText("2件").waitFor();
  await page.fill("input[type=search]", "g-shock");
  await page.waitForFunction(() => document.querySelector("main").innerText.includes("1件"));
  assert.match(await text("main"), /CASIO/);
  await page.fill("input[type=search]", "多治見");
  await page.waitForFunction(() => document.querySelector("main").innerText.includes("SONY"));
  await page.fill("input[type=search]", "");
  await page.getByRole("button", { name: "売却済み", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("main").innerText.includes("1件"));
  await page.getByRole("button", { name: "すべて", exact: true }).click();
  await shot("09-product-list");

  step("edit product");
  await page.goto(productUrl + "/edit");
  await page.fill("#shipping_cost", "850");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL(productUrl);
  await page.getByText("¥10,950").first().waitFor();

  step("settings: goal 500,000");
  await page.goto(`${BASE}/settings`);
  await page.fill("#goal-default", "500000");
  await page.getByRole("button", { name: "目標を保存" }).click();
  await page.getByText("目標を保存しました").waitFor();
  await page.goto(`${BASE}/`);
  await page.getByText("今月の実績").waitFor();
  dash = await text("main");
  assert.match(dash, /¥500,000/);
  assert.match(dash, /2\.2%/, "10950/500000=2.19%");

  step("settings: decimal margin threshold (29.9%)");
  await page.goto(`${BASE}/settings`);
  const marginInputs = page.locator("#criteria input[inputmode=decimal]");
  await marginInputs.first().fill("29.9");
  await page.getByRole("button", { name: "基準を保存" }).click();
  await page.getByText("基準を保存しました").waitFor();
  await page.goto(`${BASE}/settings`);
  assert.equal(await page.locator("#criteria input[inputmode=decimal]").first().inputValue(), "29.9");
  await marginInputs.first().fill("30");
  await page.getByRole("button", { name: "基準を保存" }).click();
  await page.getByText("基準を保存しました").waitFor();

  step("CSV import (70 rows) and paginated list");
  const header = "商品名,ブランド,カテゴリ,仕入先,仕入店舗,仕入日,仕入価格,販売先,想定販売価格,送料,ステータス,出品URL";
  const rowsCsv = Array.from({ length: 70 }, (_, i) =>
    `CSV商品${i + 1},NIKE,スニーカー,ハードオフ,ハードオフ多治見店,2026/09/${String((i % 28) + 1).padStart(2, "0")},${1000 + i},メルカリ,5000,750,出品中,${i === 0 ? "javascript:alert(1)" : "https://jp.mercari.com/item/m" + i}`,
  );
  await page.locator("#data input[type=file]").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("\uFEFF" + [header, ...rowsCsv].join("\r\n")),
  });
  await page.getByText("70件を取り込みました").waitFor({ timeout: 20000 });
  await page.goto(`${BASE}/products`);
  await page.getByText("72件").waitFor();
  assert.equal(await page.locator("main a[href^='/products/'][aria-label]").count(), 60, "first page 60 rows");
  await page.getByRole("button", { name: /さらに表示（残り12件）/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("main a[href^='/products/'][aria-label]").length === 72);
  await page.fill("input[type=search]", "ハードオフ多治見");
  await page.getByText("70件").waitFor();
  await page.fill("input[type=search]", "CSV商品1 ");
  const imported = page.locator("main a[aria-label='CSV商品1']");
  await imported.click();
  await page.getByText("ハードオフ多治見店").waitFor();
  assert.doesNotMatch(await text("main"), /出品ページを開く/, "javascript: URL was dropped");
  await page.goto(`${BASE}/inventory`);
  await page.getByText("現在在庫").waitFor();
  await page.getByRole("button", { name: /さらに表示/ }).waitFor();

  step("analytics / inventory / expenses pages render");
  await page.goto(`${BASE}/analytics`);
  await page.getByText("月別利益").waitFor();
  await page.waitForLoadState("networkidle");
  await shot("10-analytics");
  await page.getByRole("tab", { name: "仕入先" }).click();
  assert.match(await text("main"), /セカンドストリート/);
  await page.goto(`${BASE}/inventory`);
  await page.getByText("現在在庫").waitFor();
  assert.match(await text("main"), /71商品/);
  await page.goto(`${BASE}/expenses`);
  await page.fill("#exp-amount", "450");
  await page.getByRole("button", { name: "経費を追加" }).click();
  await page.getByText("経費を追加しました").waitFor();
  await page.goto(`${BASE}/`);
  await page.getByText("今月の実績").waitFor();
  assert.match(await text("main"), /¥10,500/, "10950 - 450 expense");

  step("delete product");
  await page.goto(productUrl);
  await page.getByRole("button", { name: "その他の操作" }).click();
  await page.getByRole("menuitem", { name: "削除" }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page.waitForURL(`${BASE}/products`);
  await page.getByText("71件").waitFor();

  step("unsaved uploaded image is removed from storage");
  await page.goto(`${BASE}/products/new`);
  await page.getByText("写真・メモ").click();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator("input[type=file][multiple]").setInputFiles({ name: "item.png", mimeType: "image/png", buffer: png });
  await page.getByText("1/10枚").waitFor();
  // 保存せずにアプリ内で別ページへ移動
  await page.getByRole("link", { name: "商品", exact: true }).click();
  await page.waitForURL(`${BASE}/products`);
  await page.getByText("71件").waitFor();
  await page.waitForTimeout(500);
  const log = await (await fetch(`${process.env.E2E_SUPABASE_URL || "http://localhost:54321"}/__test/storage-log`)).json();
  assert.ok(log.some((l) => l.startsWith("POST /storage/v1/object/product-images/")), "uploaded");
  assert.ok(log.some((l) => l.startsWith("DELETE /storage/v1/object/product-images")), "unsaved image deleted");

  step("offline page via service worker");
  await page.reload();
  await page.getByText("71件").waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // SW がページを制御した状態にする
  await page.getByText("71件").waitFor();
  await ctx.setOffline(true);
  await page.goto(`${BASE}/analytics`).catch(() => {});
  await page.getByText("オフラインです").waitFor();
  await shot("12-offline");
  await ctx.setOffline(false);

  step("dark mode screenshot");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`${BASE}/`);
  await shot("11-dashboard-dark");

  step("RLS: second user sees nothing");
  await ctx.clearCookies();
  await page.goto(`${BASE}/signup`);
  await page.fill("#email", `other${Date.now()}@example.com`);
  await page.fill("#password", "password123");
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/products`);
  await page.getByText("商品がまだありません").waitFor();
  await page.goto(productUrl);
  await page.getByText("ページが見つかりません").waitFor();

  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/simulator`);
  await shot("13-desktop-simulator");

  const real = errors.filter((e) => !/Failed to load resource.*(404|storage|ERR_INTERNET_DISCONNECTED)/.test(e));
  if (real.length) console.log("browser errors:\n" + real.join("\n"));
  console.log("✅ E2E PASSED");
  await browser.close();
})().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
