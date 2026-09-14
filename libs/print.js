// libs/print.js
import { chromium } from 'playwright';

const FORM_PATH='../dist-ssr'

/**
 * 帳票名に対応するSvelteコンポーネントを動的にインポートしてPDFを生成
 * @param {string} reportName - 帳票名（例：'Invoice'）
 * @param {object} props - 帳票コンポーネントに渡す props（描画データ）
 * @returns {Promise<Buffer>} - PDFのバッファ
 */
export const print = async (reportName, props) => {
  const reportPath = `${FORM_PATH}/${reportName}.js`;

  // 帳票コンポーネントのインポート（ESM動的インポート）
  const { default: ReportComponent } = await import(reportPath);
	const origin = `http://localhost:${global.env.port}/`
  // Svelte SSRによるHTML生成
  const { html, head } = ReportComponent.render(props);
  let realHead = head.replaceAll(/href="\//g,`href="${origin}`);
  const fullHTML = `
<!DOCTYPE html>
<html>
  <head>
    ${realHead}
  </head>
  <body>
  	${html}
  </body>
</html>`;
  //console.log(fullHTML);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
	page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()));
  
  await page.setContent(fullHTML, {
    waitUntil: 'networkidle',
    timeout: 10000  // 10秒で打ち切り
  });
  await page.setViewportSize({
    width: Math.round(210 / 0.264583),  // ≒ 793.7
    height: Math.round(297 / 0.264583)  // ≒ 1122.5
  });
  await page.addStyleTag({
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap'
  });
  // Webフォントの到着待ち。到着前にPDF化すると代替フォントで確定してしまう。
  // 400のみだと太字が合成太字になるため700も要求する。
  // オフライン等で取得できなくてもsystemフォントで描画できるよう短時間で打切り
  try {
    await page.evaluate(async () => {
      try {
        await Promise.race([
          Promise.all([
            document.fonts.load('400 16px "Noto Sans JP"'),
            document.fonts.load('700 16px "Noto Sans JP"'),
          ]),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      } catch { /* フォント取得失敗時はsystemフォールバックで描画 */ }
      await document.fonts.ready;
    });
  } catch { /* headless側の問題時はそのままPDF化 */ }
  const pdfBuffer = await page.pdf({
    width: '210mm',
    height: '297mm',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm',
    },
    preferCSSPageSize: true, // ← CSSの `@page size: A4` を尊重
    clip: { x: 0, y: 0, width: 793.7, height: 1122.5 }, // ← mm換算のpx
    displayHeaderFooter: false, // ← これ！！
    scale: 1.0
  });

  await browser.close();
  return pdfBuffer;
};
