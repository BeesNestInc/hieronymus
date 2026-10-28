import {assert} from 'chai';
import ExcelJS from 'exceljs';
import fs from 'fs';
import parser from '../libs/bank-statement.js';

// 明細パーサのテスト（DB不依存）。
// 実サンプル（test-data/）は個人情報を含むためコミットせず、
// 同じ構造のフィクスチャをテスト内で生成して検証する。

// 実サンプル（2025年度.xlsx）と同じ列構成のExcelを生成する
const buildBankXlsx = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('明細');
  sheet.addRow([ '日付', '内容', '出金金額(円)', '入金金額(円)', '残高(円)', 'メモ' ]);
  for ( const row of rows ) {
    sheet.addRow(row);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const xlsxRows = [
  [ new Date(2026, 7, 1), '振込＊テスト　ハナコ', null, 38268, 40288, '-' ],
  [ new Date(2026, 7, 2), 'デビット　４８３３３９', 29544, null, 10744, '-' ],
  [ new Date(2026, 7, 3), 'ＡＴＭ手数料', 140, null, 10604, '-' ],
  [ new Date(2026, 7, 4), '利息', null, 1, 10605, '-' ],
  [ new Date(2026, 7, 5), '口座振替　ミツイスミトモカード', 13155, null, null, '-' ]
];

describe('bank-statement (parser)', () => {
  it('xlsx: 実サンプルと同じ列構成を既定の名寄せで読む', async () => {
    const buffer = await buildBankXlsx(xlsxRows);
    const result = await parser.parseStatement(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(result.kind, 'bank');
    assert.lengthOf(result.lines, 5);
    assert.equal(result.lines[0].rawDescription, '振込＊テスト　ハナコ');
    assert.equal(result.lines[0].amountIn, 38268);
    assert.equal(result.lines[1].amountOut, 29544);
    assert.equal(result.lines[1].balance, 10744);
    assert.equal(result.periodFrom, '2026-08-01');
    assert.equal(result.periodTo, '2026-08-05');
  });

  it('xlsx: カテゴリを摘要から分類する', async () => {
    const buffer = await buildBankXlsx(xlsxRows);
    const result = await parser.parseStatement(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(result.lines[1].category, 'card_payment');
    assert.equal(result.lines[2].category, 'fee');
    assert.equal(result.lines[3].category, 'interest');
    assert.equal(result.lines[4].category, 'transfer');
    assert.equal(result.lines[0].category, 'normal');
  });

  it('csv: ヘッダ付きCSVを読む（カンマ区切り・改行コード差異を吸収）', async () => {
    const csv = [
      '日付,内容,出金金額(円),入金金額(円),残高(円),メモ',
      '2026-08-01,振込＊テスト　ハナコ,,38268,40288,-',
      '2026-08-02,デビット　４８３３３９,29544,,10744,-'
    ].join('\r\n');
    const result = await parser.parseStatement(Buffer.from(csv, 'utf-8'), 'text/csv');
    assert.lengthOf(result.lines, 2);
    assert.equal(result.lines[0].date, '2026-08-01');
    assert.equal(result.lines[1].amountOut, 29544);
  });

  it('残高整合: 崩れている行を警告する', async () => {
    const buffer = await buildBankXlsx(xlsxRows);
    const result = await parser.parseStatement(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // 5行目は残高空欄で前残との整合は見ないが、4行目までは連続整合するはず。
    // ここでは敢えて崩れていないので警告ゼロ
    assert.lengthOf(result.warnings, 0);
    const broken = await buildBankXlsx([
      [ new Date(2026, 7, 1), '振込', null, 1000, 1000, '-' ],
      [ new Date(2026, 7, 2), '手数料', 100, null, 200, '-' ]
    ]);
    const bad = await parser.parseStatement(broken, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.lengthOf(bad.warnings, 1);
    assert.include(bad.warnings[0], '残高が一致しません');
  });

  it('カード明細PDF: テキストアイテムから利用行を組み立てる（折り返し店名・外貨明細を含む）', () => {
    // 実サンプル（三井住友カードWeb明細）と同じトークン列を用意する。
    // 3行目の店名は折り返しで上下に分断されている
    const items = ( tokens ) => tokens.map((str, i) => {
      return { str: str, transform: [ 1, 0, 0, 1, 100 + i * 100, 400 ] };
    });
    const pdfLines = [
      { y: 500, tokens: [ 'ご利', '⽤', '⽇', 'ご利', '⽤', '店名', 'お', '⽀', '払い', '⾦', '額' ], text: '' },
      { y: 480, tokens: [ '26/04/02', 'ＧＯＯＧＬＥ＊ＣＬＯＵＤ', '5,561', '１', '１', '5,561', '◎' ], text: '' },
      { y: 460, tokens: [ 'CLAUDE.AI SUBSCRIPTION (ANTHROPIC.C' ], text: '' },
      { y: 456, tokens: [ '26/04/22', '3,634', '１', '１', '3,634', '22.00', 'USD', '165.206', '04 22', '◎' ], text: '' },
      { y: 450, tokens: [ 'OM)' ], text: '' },
      { y: 430, tokens: [ '＜お', '⽀', '払', '⾦', '額総合計＞', '13,155' ], text: '' }
    ];
    const lines = parser.cardRowsToLines(pdfLines, null);
    assert.lengthOf(lines, 2);
    assert.equal(lines[0].merchant, 'ＧＯＯＧＬＥ＊ＣＬＯＵＤ');
    assert.equal(lines[0].amount, 5561);
    // 折り返した店名が統合される
    assert.equal(lines[1].merchant, 'CLAUDE.AI SUBSCRIPTION (ANTHROPIC.COM)');
    assert.equal(lines[1].amount, 3634);
    assert.equal(lines[1].foreignAmount, 22);
    assert.equal(lines[1].foreignCurrency, 'USD');
  });

  it('pdfItemsToLines: Y座標で行に束ね、X座標順にソートする', () => {
    const items = [
      { str: 'b', transform: [ 1, 0, 0, 1, 200, 100 ] },
      { str: 'a', transform: [ 1, 0, 0, 1, 100, 100 ] },
      { str: 'c', transform: [ 1, 0, 0, 1, 100, 90 ] }
    ];
    const lines = parser.pdfItemsToLines(items);
    assert.lengthOf(lines, 2);
    assert.equal(lines[0].y, 100);
    assert.equal(lines[0].tokens.join(''), 'ab');
  });
});

describe('bank-statement (merge rules)', () => {
  const TEST_DIR = '/tmp/opencode/merge-rules-test';

  const withConfigPath = (dir, fn) => {
    const saved = process.env.BANK_CONFIG_PATH;
    process.env.BANK_CONFIG_PATH = dir;
    try {
      return fn();
    } finally {
      if ( saved === undefined ) {
        delete process.env.BANK_CONFIG_PATH;
      } else {
        process.env.BANK_CONFIG_PATH = saved;
      }
    }
  };

  it('merge-rules.yaml が無ければ既定の合流摘要を返す', () => {
    withConfigPath('/tmp/opencode/no-such-banks-dir', () => {
      const values = parser.loadMergeDescriptions();
      assert.isArray(values);
      assert.include(values, '手数料');
    });
  });

  it('merge-rules.yaml を保存・読み込みできる（roundtrip）', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    withConfigPath(TEST_DIR, () => {
      // 空要素は除かれる
      const written = parser.saveMergeDescriptions([ '手数料', '納付手数料', '' ]);
      assert.deepEqual(written, [ '手数料', '納付手数料' ]);
      assert.deepEqual(parser.loadMergeDescriptions(), [ '手数料', '納付手数料' ]);
    });
  });
});
