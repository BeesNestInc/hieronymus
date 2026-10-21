'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 明細↔明細行の対応を伝票側からも辿れるようにする。
    // 伝票の更新は明細を作り直す（CrossSlipDetail を destroy→create）ので、
    // 行側の crossSlipDetailId は常に古いIDを指してしまう。伝票側に
    // statementLineId（対象行のID）を持たせることで、更新後の対応の
    // 復元と「どの明細が取込行由来か」の判定を確実にする。
    await queryInterface.addColumn('CrossSlipDetails', 'statementLineId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'BankStatementLines',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    // 既存の紐付けからバックフィルする
    await queryInterface.sequelize.query([
      'UPDATE "CrossSlipDetails" d SET "statementLineId" = b.id',
      'FROM "BankStatementLines" b WHERE b."crossSlipDetailId" = d.id'
    ].join(' '));
    // 数字を'#'に潰した旧形式の学習ルール（デビット# 等）は新しい
    // 完全一致方式では照合対象にならない。余計な提案を出さないよう削除する
    await queryInterface.sequelize.query(
      'DELETE FROM "BankStatementRules" WHERE pattern LIKE \'%#%\''
    );
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('CrossSlipDetails', 'statementLineId');
  }
};
