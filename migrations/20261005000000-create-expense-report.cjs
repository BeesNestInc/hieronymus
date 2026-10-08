'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 経費精算マッピングテーブル（支払先/出金元と実際の勘定科目の対応）
    // kind: 'payee'(支払先→経費科目) | 'payment'(出金元→貸方科目)
    await queryInterface.createTable('ExpenseMappings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      kind: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'payee'
      },
      key: {
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING
      },
      companyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Companies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      account: {
        type: Sequelize.STRING
      },
      subAccount: {
        type: Sequelize.INTEGER
      },
      advance: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      displayOrder: {
        type: Sequelize.INTEGER
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

    // 経費精算書ヘッダ
    await queryInterface.createTable('ExpenseReports', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      submittedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      submittedAt: {
        type: Sequelize.DATE
      },
      companyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Companies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      taskId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Tasks',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      purpose: {
        type: Sequelize.TEXT
      },
      approvedAt: {
        type: Sequelize.DATE
      },
      approvedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      crossSlipId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'CrossSlips',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdBy: {
        type: Sequelize.INTEGER
      },
      updatedBy: {
        type: Sequelize.INTEGER
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

    // 経費精算明細
    await queryInterface.createTable('ExpenseReportLines', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      expenseReportId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ExpenseReports',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      lineNo: {
        type: Sequelize.INTEGER
      },
      paymentDate: {
        type: Sequelize.DATEONLY
      },
      companyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Companies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      description: {
        type: Sequelize.STRING
      },
      amount: {
        type: Sequelize.DECIMAL(12)
      },
      paymentMappingId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'ExpenseMappings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      note: {
        type: Sequelize.STRING
      },
      voucherId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Vouchers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      taxRuleId: {
        type: Sequelize.INTEGER
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

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('ExpenseReportLines');
    await queryInterface.dropTable('ExpenseReports');
    await queryInterface.dropTable('ExpenseMappings');
  }
};
