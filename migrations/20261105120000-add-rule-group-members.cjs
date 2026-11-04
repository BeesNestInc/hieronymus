'use strict';

// 計算書の「まとめ」（明細の複数行を伝票の1行にするグループ）を学習ルールに
// 永続化する。groupMembers にメンバ明細の正規化パターン（JSON配列）を持ち、
// 次回の計算書取込で「メンバーが揃ったら同じまとめ」を自動的に組むためのもの。
// pattern は代表ラベル（まとめの摘要）で、既存の単行ルールと同一キーになり得る
// が、どちらも照合に使え、害はない
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('BankStatementRules', 'groupMembers', {
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
      await queryInterface.removeColumn('BankStatementRules', 'groupMembers', { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }
};
