'use strict';

// 計算書（kind: settlement）の「1伝票にして起票」パネルの選択状態
// （対象外チェック・費用行の科目・まとめグループ）を取込側に保存する。
// これまでは sessionStorage（ブラウザ依存）だったため、別端末や
// ブラウザを閉じたあとは作業下書きが消えた。サーバ側に作業下書きを
// 持たせて保存する（起票成功でクリア。ルール/伝票には含まない作業状態）
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('BankStatements', 'settleDraft', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down (queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('BankStatements', 'settleDraft', { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }
};
