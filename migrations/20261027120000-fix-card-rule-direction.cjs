'use strict';

// カード口座（corporate_card）のルールは方向=出金に統一する。
// カードの行は常に「出金」（利用額が支払欄に載る）ので、'in'のルールは
// 適用されない死にデータ（過去のプリセットバグ由来）。
// 意図（借=現金等/貸=短期借入金）は direction='out' + creditAccount で表現される
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "BankStatementRules" r
      SET "direction" = 'out'
      FROM "Financials" f
      WHERE r."financialId" = f.id
        AND f."kind" = 'corporate_card'
        AND r."direction" = 'in'
    `);
  },

  async down (queryInterface) {
    // downでは復元しない（意図的な一方向化のため）
  }
};
