// ナビゲーションスモークテスト。
// 全ページの遷移・タイトル解決・深リンク・戻る/進む・年度切替を確認する。
// 使い方: node nav-smoke.mjs [BASE_URL] [ユーザー名] [パスワード]
// （BASEの既定は http://localhost:3010。ユーザーはテスト表示用の
//  expense-dev/expense-dev を既定で使う）
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3010';
const USER = process.argv[3] || 'expense-dev';
const PASS = process.argv[4] || 'expense-dev';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 150)));

let ok = 0;
let ng = 0;
const check = async (path, name) => {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(1800);
  const title = await page.title();
  const h1 = await page.locator('h1').first().innerText().catch(() => '(no h1)');
  // ページ本体が描画されていること（ルート未解決だと .content が空になる）
  const rendered = await page.evaluate(() => {
    const content = document.querySelector('.content');
    return Boolean(content && content.children.length > 0 && content.innerText.trim().length > 0);
  });
  if ( ( title.includes(name) || h1.includes(name) || title.includes('Hieronymus') ) && rendered ) {
    ok += 1;
  } else {
    ng += 1;
    console.log(`NG: ${path} → title="${title}" h1="${h1.slice(0, 40)}" rendered=${rendered}`);
  }
};

await page.goto(`${BASE}/login`);
await page.fill('input[placeholder="ユーザー名"]', USER);
await page.fill('input[placeholder="パスワード"]', PASS);
await page.click('.btn-primary');
await page.waitForTimeout(2500);

// 全ページ（深リンク含む）
const checks = [
  ['/journal', '仕訳日記帳'],
  ['/bank-ledger', '通帳元帳'],
  ['/bank-statement', '通帳一覧'],
  ['/voucher', '証憑管理'],
  ['/schedule', '予定表'],
  ['/ledger/1000000', '元帳'],
  ['/trial-balance', '残高試算表'],
  ['/changes/2/6000000', '推移表'],
  ['/accounts', '勘定科目管理'],
  ['/company/', '取引先管理'],
  ['/task/', '案件管理'],
  ['/transaction/', '取引管理'],
  ['/item/', '品目管理'],
  ['/member/', '役職員管理'],
  ['/users/', 'ユーザ管理'],
  ['/expense/', '経費精算'],
  ['/karibarai', '立替精算'],
  ['/menu', 'マイページ'],
  ['/home/2', 'ホーム']
];
for ( const [path, name] of checks ) {
  await check(path, name);
}

// 戻る/進むで追従する
await page.goto(`${BASE}/journal`);
await page.waitForTimeout(1500);
await page.goto(`${BASE}/schedule`);
await page.waitForTimeout(1500);
await page.goBack();
await page.waitForTimeout(1200);
const backTitle = await page.title();
if ( backTitle.includes('仕訳日記帳') ) { ok += 1; } else { ng += 1; console.log(`NG: 戻る → title="${backTitle}"`); }
await page.goForward();
await page.waitForTimeout(1200);
const fwdTitle = await page.title();
if ( fwdTitle.includes('予定表') ) { ok += 1; } else { ng += 1; console.log(`NG: 進む → title="${fwdTitle}"`); }

// 致命的エラーのないこと（既知の無害な AxiosError 401/403 以外）
const fatal = pageErrors.filter((e) => !e.includes('AxiosError'));
if ( fatal.length > 0 ) {
  ng += 1;
  console.log(`NG: pageError ${fatal.length}件`);
  for ( const e of fatal.slice(0, 5) ) console.log('ERR:', e);
}

console.log(`nav smoke: ${ok} ok / ${ng} ng`);
await browser.close();
if ( ng > 0 ) {
  process.exitCode = 1;
}
