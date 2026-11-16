'use strict';

// Sticky をメッセージ機能として使うためのスキーマ整理。
//
// Sticky: 作者と本文だけのメッセージ本体
//   - authorId / message を持つ
//   - 初期構想（documentId ベース・旧 create-sticky マイグレーション）の
//     カラム documentId / receiverId / showHide / importance / completedAt は削除
//   - 環境によっては sync で新形状が作られている（列の有無が混在する）ため、
//     describeTable で存在確認してから操作する
//
// StickyStatus: 受信者ごとのメッセージ状態
//   - stickyId / receiverId / importance（重要度・温存）/ readAt（未読= readAt IS NULL）
//   - 旧構想の posX / posY / showHide / completedAt は削除
//   - sync 運用の環境にはテーブルが無いことがあるので、無ければ作る
/** @type {import('sequelize-cli').Migration} */
const STICKY_STATUS_COLUMNS = (Sequelize) => ({
  stickyId: {
    type: Sequelize.INTEGER,
    references: {
      model: 'Stickies',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  receiverId: {
    type: Sequelize.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  importance: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  readAt: {
    type: Sequelize.DATE,
    allowNull: true
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

module.exports = {
  async up (queryInterface, Sequelize) {
    // --- Stickies ---
    const stickyDesc = await queryInterface.describeTable('Stickies');
    if ( !stickyDesc.authorId ) {
      await queryInterface.addColumn('Stickies', 'authorId', {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        allowNull: true
      });
    }
    if ( !stickyDesc.message ) {
      await queryInterface.addColumn('Stickies', 'message', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    for (const col of ['documentId', 'receiverId', 'showHide', 'importance', 'completedAt']) {
      if ( stickyDesc[col] ) {
        await queryInterface.removeColumn('Stickies', col);
      }
    }

    // --- StickyStatuses ---
    let statusDesc;
    try {
      statusDesc = await queryInterface.describeTable('StickyStatuses');
    } catch (e) {
      statusDesc = null;
    }
    if ( !statusDesc ) {
      await queryInterface.createTable('StickyStatuses', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        ...STICKY_STATUS_COLUMNS(Sequelize)
      });
    } else {
      for (const [col, def] of Object.entries(STICKY_STATUS_COLUMNS(Sequelize))) {
        if ( !statusDesc[col] ) {
          await queryInterface.addColumn('StickyStatuses', col, def);
        }
      }
      for (const col of ['posX', 'posY', 'showHide', 'completedAt']) {
        if ( statusDesc[col] ) {
          await queryInterface.removeColumn('StickyStatuses', col);
        }
      }
    }
  },

  async down (queryInterface, Sequelize) {
    // down は旧構想（documentId ベース）には戻さない。
    // 消したメッセージの復元は意味を持たないため、付加カラムの復元のみ行う
    const statusDesc = await queryInterface.describeTable('StickyStatuses');
    for (const [col, def] of [
      ['showHide', { type: Sequelize.BOOLEAN, allowNull: true }],
      ['posX', { type: Sequelize.INTEGER, allowNull: true }],
      ['posY', { type: Sequelize.INTEGER, allowNull: true }],
      ['completedAt', { type: Sequelize.DATE, allowNull: true }]
    ]) {
      if ( !statusDesc[col] ) {
        await queryInterface.addColumn('StickyStatuses', col, def);
      }
    }
    if ( statusDesc.readAt ) {
      await queryInterface.removeColumn('StickyStatuses', 'readAt');
    }
  }
};
