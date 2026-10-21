'use strict';

// システム都合の科目（x9xxxxx）を「なかったらINSERT」する。
// sequelize-cli の --env（test/development）と直結させるため、models を
// 使わず生SQLで実行する（models の接続先は NODE_ENV 依存で
// ミグレーションの対象DBとずれるため）。
// - 出金仮 1900000（資産側。取込明細の出金行の相手方に仮置き）
// - 入金仮 3900000（負債側。取込明細の入金行の相手方に仮置き）
// 同じ補助を libs/ensure-system-accounts.js も初期設定フローから叩くが、
// 既存DBではこのマイグレーションが確実に用意しておく。

const QUERY = [
  // 出金仮（1,90）
  `INSERT INTO "AccountClasses" (major, middle, minor, field, adding, "createdAt", "updatedAt")
   SELECT '資産', '流動資産', '出金仮', 1, 90, NOW(), NOW()
   WHERE NOT EXISTS (SELECT 1 FROM "AccountClasses" WHERE "field" = 1 AND "adding" = 90)`,
  `INSERT INTO "Accounts" (name, key, "accountClassId", "accountCode", "taxClass", "subAccountCount", "createdAt", "updatedAt")
   SELECT '出金仮', 'shukkinkari', c.id, '1900000', 0, 0, NOW(), NOW()
   FROM "AccountClasses" c
   WHERE c."field" = 1 AND c."adding" = 90
   AND NOT EXISTS (SELECT 1 FROM "Accounts" WHERE "accountCode" = '1900000')`,
  // 入金仮（3,90）
  `INSERT INTO "AccountClasses" (major, middle, minor, field, adding, "createdAt", "updatedAt")
   SELECT '負債', '流動負債', '入金仮', 3, 90, NOW(), NOW()
   WHERE NOT EXISTS (SELECT 1 FROM "AccountClasses" WHERE "field" = 3 AND "adding" = 90)`,
  `INSERT INTO "Accounts" (name, key, "accountClassId", "accountCode", "taxClass", "subAccountCount", "createdAt", "updatedAt")
   SELECT '入金仮', 'nyukinkari', c.id, '3900000', 0, 0, NOW(), NOW()
   FROM "AccountClasses" c
   WHERE c."field" = 3 AND c."adding" = 90
   AND NOT EXISTS (SELECT 1 FROM "Accounts" WHERE "accountCode" = '3900000')`
];

const QUERY_REMAININGS = [
  // 既存の期分の残高行をゼロで用意する
  `INSERT INTO "AccountRemainings" ("accountId", term, debit, credit, balance, "createdAt", "updatedAt")
   SELECT a.id, f.term, 0, 0, 0, NOW(), NOW()
   FROM "Accounts" a, "FiscalYears" f
   WHERE a."accountCode" = '1900000'
   AND NOT EXISTS (
     SELECT 1 FROM "AccountRemainings" r WHERE r."accountId" = a.id AND r.term = f.term)`,
  `INSERT INTO "AccountRemainings" ("accountId", term, debit, credit, balance, "createdAt", "updatedAt")
   SELECT a.id, f.term, 0, 0, 0, NOW(), NOW()
   FROM "Accounts" a, "FiscalYears" f
   WHERE a."accountCode" = '3900000'
   AND NOT EXISTS (
     SELECT 1 FROM "AccountRemainings" r WHERE r."accountId" = a.id AND r.term = f.term)`
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
    const run = async (queries) => {
      for ( const sql of queries ) {
        await queryInterface.sequelize.query(sql);
      }
    };
    await run(QUERY);
    await run(QUERY_REMAININGS);
  },

  async down () {
    // 科目はアカウント管理画面で消す前提。削除しない
  }
};
