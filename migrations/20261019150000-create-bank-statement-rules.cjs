'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 学習ルール: 摘要パターン → 相手方仕訳。
    // 明細取込での起票や伝票入力から「やっているうちに覚える」ためのもの。
    // pattern は摘要を正規化したテンプレート（数字を'#'に置換）で完全一致する。
    // account+subAccount は学習元の口座（subAccount null は口座全体で共通）
    await queryInterface.createTable('BankStatementRules', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      account: {
        type: Sequelize.STRING,
        allowNull: false
      },
      subAccount: {
        type: Sequelize.INTEGER
      },
      pattern: {
        type: Sequelize.STRING,
        allowNull: false
      },
      oppositeAccount: {
        type: Sequelize.STRING,
        allowNull: false
      },
      oppositeSubAccount: {
        type: Sequelize.INTEGER
      },
      usageCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('BankStatementRules');
  }
};
