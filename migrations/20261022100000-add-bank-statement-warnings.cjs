'use strict';

// 取込時に検出した警告（残高整合・重複スキップ等）を取り込インスタンスに
// 持たせる。警告はupload応答のその場限りではなく取込詳細画面で閲覧する
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('BankStatements', 'warnings', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('BankStatements', 'warnings');
  }
};
