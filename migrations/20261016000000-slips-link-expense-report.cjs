'use strict';

// 経費精算書と仕訳伝票の関連を 1:1（ExpenseReports.crossSlipId）から
// 1:n（CrossSlips.expenseReportId 逆FK）へ移行する。
// 既存の紐付けはバックフィルし、旧列は削除する。
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('CrossSlips', 'expenseReportId', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction: transaction });
      // 既存の1:1紐付けを逆流させる（1伝票は高々1精算書に紐付いていた）
      await queryInterface.sequelize.query(
        `UPDATE "CrossSlips"
         SET "expenseReportId" = er.id
         FROM "ExpenseReports" er
         WHERE er."crossSlipId" = "CrossSlips".id`, { transaction: transaction });
      await queryInterface.addConstraint('CrossSlips', {
        fields: ['expenseReportId'],
        type: 'foreign key',
        name: 'crossslips_expense_report_fk',
        references: {
          table: 'ExpenseReports',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction: transaction
      });
      await queryInterface.addIndex('CrossSlips', ['expenseReportId'], {
        name: 'crossslips_expense_report_id',
        transaction: transaction
      });
      await queryInterface.removeColumn('ExpenseReports', 'crossSlipId', { transaction: transaction });
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('ExpenseReports', 'crossSlipId', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction: transaction });
      // 1:nのうち先頭の伝票に戻す（1:1へ強制縮退。複数は切れる）
      await queryInterface.sequelize.query(
        `UPDATE "ExpenseReports"
         SET "crossSlipId" = cs.id
         FROM (
           SELECT DISTINCT ON ("expenseReportId") id, "expenseReportId"
           FROM "CrossSlips"
           WHERE "expenseReportId" IS NOT NULL
           ORDER BY "expenseReportId", year, month, day, no
         ) cs
         WHERE cs."expenseReportId" = "ExpenseReports".id`, { transaction: transaction });
      await queryInterface.addConstraint('ExpenseReports', {
        fields: ['crossSlipId'],
        type: 'foreign key',
        name: 'expensereports_cross_slip_fk',
        references: {
          table: 'CrossSlips',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction: transaction
      });
      await queryInterface.removeConstraint('CrossSlips', 'crossslips_expense_report_fk', { transaction: transaction });
      await queryInterface.removeIndex('CrossSlips', 'crossslips_expense_report_id', { transaction: transaction });
      await queryInterface.removeColumn('CrossSlips', 'expenseReportId', { transaction: transaction });
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }
};
