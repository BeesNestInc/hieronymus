// ナビゲーションスモークテスト。
// 全ページの遷移・タイトル解決・深リンク・戻る/進む・年度切替を確認する。
// 使い方: node nav-smoke.mjs [BASE_URL] [ユーザー名] [パスワード]
// （BASEの既定は http://localhost:3010。ユーザーはテスト表示用の
//  expense-dev/expense-dev を既定で使う）
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3010';
const USER = process.argv[3] || 'expense-dev';
const PASS = process.argv[4] || 'expense-dev';
// 本番DBでの参照系チェック用: 第5引数に readonly を付けると
// 書き込みを伴う相互作用（付箋作成等）をスキップする
const readonly = process.argv[5] === 'readonly';

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

// ---- 相互作用検査（「URLは変わるのに画面が遷移しない」クラスを捕まえる） ----
const interaction = async (name, fn) => {
  try {
    await fn();
    ok += 1;
  } catch (e) {
    ng += 1;
    console.log(`NG: ${name}: ${String(e).slice(0, 120)}`);
  }
};

// 仕訳日記帳の月送り（openMonth: currentPageを更新しない遷移）→ 選択月が移る
await interaction('仕訳の月送り', async () => {
  await page.goto(`${BASE}/journal/2025/8`);
  await page.waitForTimeout(1800);
  // 現在月以外の月ボタン（outline）を押す → 選択月（primary）が移る
  const monthBtn = page.locator('button.btn-outline-primary:has-text("月")').first();
  const label = (await monthBtn.innerText()).trim();
  await monthBtn.click();
  await page.waitForTimeout(1000);
  const current = (await page.locator('button.btn-primary:has-text("月")').first().innerText()).trim();
  if ( current !== label ) throw new Error(`選択月が移っていない (期待: ${label} / 実際: ${current})`);
});

// 元帳の科目切替 → 内容が変わる
await interaction('元帳の科目切替', async () => {
  await page.goto(`${BASE}/ledger/1000000`);
  await page.waitForTimeout(1800);
  await page.locator('a.nav-link:has-text("予定表")').count(); // タブだけのウォームアップ
  await page.goto(`${BASE}/ledger/6000000`);
  await page.waitForTimeout(1800);
  const code = await page.evaluate(() => document.querySelector('.content').innerText.includes('売上') || document.querySelector('.content').innerText.includes('6000000'));
  if ( !code ) throw new Error('科目内容が表示されない');
});

// 付箋の作成 → ベルの未読バッジが増える（書き込みを伴うので readonly ではスキップ）
await interaction('付箋の作成（書き込み検査）', async () => {
  if ( readonly ) {
    console.log('  (readonly モード: スキップ)');
    return;
  }
  await page.goto(`${BASE}/home/2`);
  await page.waitForTimeout(2000);
  // ベル本体の未読バッジ（.sticky-wrap 内にはパネルのタブバッジ等も
  // .badge を持つため、ベル直下の要素に限定する）
  const badge = () => page.locator('.sticky-wrap > button .badge').innerText().then((t) => parseInt(t) || 0).catch(() => 0);
  const beforeN = await badge();
  await page.locator('.sticky-wrap > button').click();
  await page.waitForTimeout(600);
  await page.locator('.sticky-panel button:has-text("新規")').click();
  await page.waitForTimeout(500);
  await page.locator('.sticky-modal textarea').fill('nav-smoke からの付箋');
  // 自分宛メモ（kind: memo）として保存する（宛先選択不要。ボタンは「保存」）
  await page.locator('#sticky-kind-memo').click();
  await page.waitForTimeout(400);
  await page.locator('.sticky-modal button:has-text("保存")').click();
  await page.waitForTimeout(1200);
  const afterN = await badge();
  if ( afterN <= beforeN ) throw new Error(`未読バッジが増えていない (${beforeN} → ${afterN})`);
  // 作成した付箋を掃除（自分宛コピーを削除）
  await page.locator('.sticky-item:has-text("nav-smoke からの付箋")').first().click();
  await page.waitForTimeout(500);
  page.once('dialog', (d) => d.accept());
  await page.locator('.sticky-item button:has-text("削除")').first().click();
  await page.waitForTimeout(1000);
});

// 予定表の月送り → 表示月が変わる
await interaction('予定表の月送り', async () => {
  await page.goto(`${BASE}/schedule`);
  await page.waitForTimeout(1800);
  const before = await page.locator('.page-title span, .page-title .fw-bold').first().innerText();
  await page.locator('button:has-text(">")').last().click();
  await page.waitForTimeout(1000);
  const after = await page.locator('.page-title span, .page-title .fw-bold').first().innerText();
  if ( before === after ) throw new Error(`月が変わらない (${before.slice(0, 30)})`);
});

// マイページのウィジェットリンク（MenuLink）クリック → 対象ページへ遷移する
await interaction('マイページのウィジェットリンク', async () => {
  await page.goto(`${BASE}/menu`);
  await page.waitForTimeout(1800);
  // 会計メニュー等のテンプレートから MenuLink 入りページがなければスキップ条件になる
  const link = page.locator('.grid-stack-item-content a.link').first();
  if ( await link.count() === 0 ) {
    console.log('  (ウィジェットリンクなし: スキップ)');
    return;
  }
  const beforeUrl = page.url();
  await link.click();
  await page.waitForTimeout(1500);
  if ( page.url() === beforeUrl ) throw new Error('URLが変わっていない');
  const rendered = await page.evaluate(() => {
    const c = document.querySelector('.content');
    return Boolean(c && c.innerText.trim().length > 0);
  });
  if ( !rendered ) throw new Error('遷移先が描画されていない');
});

// ホームの取引先リンク（自社情報の確認）→ 遷移する
await interaction('ホームの取引先リンク', async () => {
  await page.goto(`${BASE}/home/2`);
  await page.waitForTimeout(2500);
  const btn = page.locator('button:has-text("自社情報の確認")');
  if ( await btn.count() === 0 ) {
    console.log('  (自社情報なし: スキップ)');
    return;
  }
  await btn.click();
  await page.waitForTimeout(1500);
  if ( !page.url().includes('/company/entry/') ) throw new Error(`遷移していない: ${page.url()}`);
});

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
