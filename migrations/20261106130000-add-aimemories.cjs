'use strict';

// AIメモリー（振り返りで蓄える）テーブル。ユーザー単位の嗜好・定番パターンを
// 記録し、manifests 実行時の文脈として読み戻す（履歴なし運用の代替品）。
// kind: 'profile' / 'learned'。key: learned の見出し。value: 本文。
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('Aimemories', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        userId: {
          type: Sequelize.INTEGER,
          references: {
            model: 'Users',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        kind: {
          type: Sequelize.STRING(32),
          allowNull: false
        },
        key: {
          type: Sequelize.STRING(120),
          allowNull: false,
          defaultValue: ''
        },
        value: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE },
        updatedAt: { type: Sequelize.DATE }
      }, { transaction: t });
      await queryInterface.addIndex('Aimemories', [ 'userId', 'kind', 'key' ], {
        unique: true,
        name: 'aimemories_user_kind_key',
        transaction: t
      });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down (queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('Aimemories', { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }
};
