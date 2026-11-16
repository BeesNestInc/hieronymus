// 予定表(schedule.md)のスクショ撮影
// 撮影はテスト表示用ユーザー expense-dev で実施。サンプル予定は会社共有データ
import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const OUT = 'documents/images';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });

await page.goto(`${BASE}/login`);
await page.fill('input[placeholder="ユーザー名"]', 'expense-dev');
await page.fill('input[placeholder="パスワード"]', 'expense-dev');
await page.click('.btn-primary');
await page.waitForURL((url) => !String(url).includes('/login'), { timeout: 20000 }).catch(() => {});
await page.goto(`${BASE}/home/2`);
await page.waitForTimeout(3500);
// 期表示が第2期になるのを待つ（稀に既定の第1期のまま描画されることがある）
for ( let i = 0; i < 5; i += 1 ) {
  const nav = await page.locator('nav.main-header').innerText();
  if ( nav.includes('第2期') ) {
    break;
  }
  await page.goto(`${BASE}/home/2`);
  await page.waitForTimeout(1500);
}

const shot = async (file) => {
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log('shot:', file);
};
const closeModal = async () => {
  await page.locator('.schedule-modal .btn-close').click();
  await page.waitForTimeout(400);
};

// ============ 予定表ページ（当月・カレンダー） ============
// サイドバーのリンクから入る（期表示がセッションの処理期になる）
await page.click('.nav-sidebar a.nav-link:has-text("予定表")');
await page.waitForTimeout(2500);
await shot('予定表ページ.png');

// ============ 作成モーダル ============
await page.locator('button:has-text("新規")').first().click();
await page.waitForTimeout(800);
await shot('予定作成モーダル.png');
await closeModal();

// ============ 年ビュー ============
await page.locator('button:has-text("年")').first().click();
await page.waitForTimeout(2000);
await shot('予定表ページ(年ビュー).png');

// ============ 月ビューに戻る（2026-11） ============
await page.locator('button:has-text("月")').first().click();
await page.waitForTimeout(2000);

// ============ 個別変更モーダル（カレンダーの予定をクリック） ============
await page.locator('.cal-ev:has-text("家賃")').first().click();
await page.waitForTimeout(800);
await shot('予定の個別変更モーダル.png');
await page.locator('.schedule-modal .btn-close').click();
await page.waitForTimeout(400);

// ============ 単発予定のある月（2027-06） ============
for ( let i = 0; i < 7; i += 1 ) {
  await page.locator('button:has-text(">")').last().click();
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);
await shot('予定表ページ(単発).png');

await browser.close();
console.log('SCHEDULE SHOTS DONE');
