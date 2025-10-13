'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Projectsテーブルを新規作成する
    await queryInterface.createTable('Projects', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      code: {
        type: Sequelize.STRING,
        unique: true
      },
      startDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      endDate: {
        type: Sequelize.DATEONLY,
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

    // CrossSlipDetailsテーブルにprojectIdカラムを追加する
    await queryInterface.addColumn('CrossSlipDetails', 'projectId', {
      type: Sequelize.INTEGER,
      allowNull: true, // プロジェクトが紐付かない明細も許容する
      references: {
        model: 'Projects', // 外部キー参照先テーブル
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL' // 参照先のプロジェクトが削除された場合、このカラムをNULLにする
    });
  },

  async down (queryInterface, Sequelize) {
    // CrossSlipDetailsテーブルからprojectIdカラムを削除する
    await queryInterface.removeColumn('CrossSlipDetails', 'projectId');

    // Projectsテーブルを削除する
    await queryInterface.dropTable('Projects');
  }
};
