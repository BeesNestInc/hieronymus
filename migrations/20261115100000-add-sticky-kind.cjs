'use strict';

// Sticky に種別を持たせる。
// kind: 'handoff'（申し送り: 他人に伝えるもの）/ 'memo'（メモ: 自分用）
// 宛先の構成で決まるので既存行（他人宛に送られたメッセージ）は handoff に寄せる
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('Stickies');
    if ( !desc.kind ) {
      await queryInterface.addColumn('Stickies', 'kind', {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'handoff'
      });
      await queryInterface.sequelize.query(
        'UPDATE "Stickies" SET kind = \'handoff\' WHERE kind IS NULL');
    }
  },

  async down (queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('Stickies');
    if ( desc.kind ) {
      await queryInterface.removeColumn('Stickies', 'kind');
    }
  }
};
