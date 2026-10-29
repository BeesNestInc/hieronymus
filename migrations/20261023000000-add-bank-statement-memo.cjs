'use strict';

// 通帳（取り込の集積体）にユーザーのメモを持たせる。
// 注意事項や本通货の運用断片などを書く。noteは追加取込の来歴自動記録用に
// なるため、メモは別カラムとする
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('BankStatements', 'memo', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('BankStatements', 'memo');
  }
};
