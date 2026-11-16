'use strict';

// 予定の個別（例外）設定。月次予定の特定の月だけ、金額や内容を差し替える。
// 用途: 「ざくっと金額を入れておいて、確定したら本当の金額を入れる」。
//   - deleted: true のときはその月の予定自体を取り消す（表示しない）
//   - (scheduleId, date) で一意。date は展開後の実際の発生日
//     （dayOfMonth=31 が2月に繰り上がる場合は繰り上げ後の日付）
// 単発（once）の予定には個別設定を使わない（直接編集すればよい）
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let existing = true;
    try {
      await queryInterface.describeTable('ScheduleOverrides');
    } catch (e) {
      existing = false;
    }
    if ( existing ) {
      return;
    }
    await queryInterface.createTable('ScheduleOverrides', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      scheduleId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Schedules',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: true
      },
      kind: {
        type: Sequelize.STRING(8),
        allowNull: true
      },
      amount: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
    await queryInterface.addIndex('ScheduleOverrides', ['scheduleId', 'date'], {
      unique: true,
      name: 'schedule_overrides_schedule_date'
    });
  },

  async down (queryInterface) {
    const desc = await queryInterface.describeTable('ScheduleOverrides');
    if ( desc ) {
      await queryInterface.dropTable('ScheduleOverrides');
    }
  }
};
