'use strict';

// 予定表（資金繰り予定）。
// 月次の定常入出金（家賃・給与支払等）と単発の予定を登録し、
// 月次一覧とICSフィードの元になる。実績（通帳・仕訳）との突合は次フェーズ
//   recurrence: 'monthly'（dayOfMonth で発生日。0=月末）/ 'once'（date で発生日）
//   kind: 'in'（入金）/ 'out'（出金）
// あわせて Users に feedToken を追加する（ICSフィードのトークン認証。
// Googleカレンダー等の購読クライアントはセッションCookieを持てないため）
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // --- Schedules ---
    let hasSchedules = true;
    try {
      await queryInterface.describeTable('Schedules');
    } catch (e) {
      hasSchedules = false;
    }
    if ( !hasSchedules ) {
      await queryInterface.createTable('Schedules', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false
        },
        kind: {
          type: Sequelize.STRING(8),
          allowNull: false,
          defaultValue: 'out'
        },
        amount: {
          type: Sequelize.BIGINT,
          allowNull: false,
          defaultValue: 0
        },
        recurrence: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: 'monthly'
        },
        dayOfMonth: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        date: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        note: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        enabled: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
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
    }

    // --- Users.feedToken ---
    const userDesc = await queryInterface.describeTable('Users');
    if ( !userDesc.feedToken ) {
      await queryInterface.addColumn('Users', 'feedToken', {
        type: Sequelize.STRING(64),
        allowNull: true
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // テーブルごと消す（消した予定の復元は意味を持たない）
    await queryInterface.dropTable('Schedules');
    const userDesc = await queryInterface.describeTable('Users');
    if ( userDesc.feedToken ) {
      await queryInterface.removeColumn('Users', 'feedToken');
    }
  }
};
