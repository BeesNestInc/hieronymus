// 付箋・申し送り(sticky.md)のスクショ撮影
// サンプル付箋はテスト表示用ユーザー(user 24 サンプル太郎 / user 31 expense-dev)
// 配信のもののみ。実ユーザー(ogochan/mitani)には配信しない
import { chromium } from 'playwright';

const BASE = 'http://localhost:3010';
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
// ホームの障害トースト（AI設定読み込み失敗等）があれば消しておく
try {
  await page.locator('.toast .btn-close, [class*="toast"] button.btn-close').first()
    .click({ timeout: 3000 });
  await page.waitForTimeout(400);
} catch (e) {
  // トーストが無ければ続行
}

const shot = async (file, locator = null) => {
  if ( locator ) {
    await locator.screenshot({ path: `${OUT}/${file}` });
  } else {
    await page.screenshot({ path: `${OUT}/${file}` });
  }
  console.log('shot:', file);
};
const closePanel = async () => {
  await page.mouse.click(800, 600);
  await page.waitForTimeout(400);
};
const closeModal = async () => {
  await page.locator('.sticky-modal .btn-close').click();
  await page.waitForTimeout(400);
};

// ============ ベル(未読バッジ) ============
const bell = page.locator('.sticky-wrap > button');
await bell.waitFor({ timeout: 10000 });
await shot('付箋ベル(未読バッジ).png', page.locator('nav.main-header'));

// ============ 一覧パネル(全て) ============
await bell.click();
await page.waitForTimeout(800);
await shot('付箋一覧パネル.png');

// ============ 内容を開く(至急の付箋) ============
await page.locator('.sticky-item').first().click();
await page.waitForTimeout(800);
await shot('付箋の内容.png');

// 閉じて、別の未読(重要)を開いて転送モーダル
await closePanel();
await bell.click();
await page.waitForTimeout(600);
await page.locator('.sticky-item').first().click();
await page.waitForTimeout(600);
await page.locator('.sticky-item button:has-text("転送")').first().click();
await page.waitForTimeout(800);
await shot('付箋の転送モーダル.png');
await closeModal();

// ============ 作成モーダル(申し送り) ============
await bell.click();
await page.waitForTimeout(600);
await page.locator('.sticky-panel button:has-text("新規")').click();
await page.waitForTimeout(800);
await shot('付箋作成モーダル.png');

// ============ 作成モーダル(メモ) ============
await page.locator('#sticky-kind-memo').click();
await page.waitForTimeout(500);
await shot('付箋作成モーダル(メモ).png');
await closeModal();

// ============ メモタブ ============
await bell.click();
await page.waitForTimeout(600);
await page.locator('.sticky-tab:has-text("メモ")').click();
await page.waitForTimeout(500);
await shot('付箋一覧パネル(メモタブ).png');

await browser.close();
console.log('STICKY SHOTS DONE');
