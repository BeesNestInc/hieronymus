'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 取り込み済み明細のヘッダ
    // kind: 'bank'(銀行通帳) | 'corporate_card'(社用カード) | 'personal_card'(個人カード立替)
    // 銀行系は account+subAccount(補助科目=subAccountCode)で口座を特定する
    await queryInterface.createTable('BankStatements', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      kind: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'bank'
      },
      account: {
        type: Sequelize.STRING
      },
      subAccount: {
        type: Sequelize.INTEGER
      },
      cardName: {
        type: Sequelize.STRING
      },
      memberId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      fileName: {
        type: Sequelize.STRING
      },
      mimeType: {
        type: Sequelize.STRING
      },
      fileBody: {
        type: Sequelize.BLOB
      },
      periodFrom: {
        type: Sequelize.DATEONLY
      },
      periodTo: {
        type: Sequelize.DATEONLY
      },
      lineCount: {
        type: Sequelize.INTEGER
      },
      note: {
        type: Sequelize.TEXT
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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

    // 明細行。銀行系は amountIn/amountOut/balance、カード系は amount/merchant を使う
    // category: 'normal'|'interest'|'fee'|'card_payment'|'tax'|'transfer'|'other'
    // status: 'unmatched'|'matched'|'booked'|'ignored'
    await queryInterface.createTable('BankStatementLines', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      statementId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'BankStatements',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      lineNo: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      date: {
        type: Sequelize.DATEONLY
      },
      rawDescription: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.STRING
      },
      amountIn: {
        type: Sequelize.DECIMAL(12)
      },
      amountOut: {
        type: Sequelize.DECIMAL(12)
      },
      balance: {
        type: Sequelize.DECIMAL(12)
      },
      amount: {
        type: Sequelize.DECIMAL(12)
      },
      merchant: {
        type: Sequelize.STRING
      },
      foreignAmount: {
        type: Sequelize.DECIMAL(12)
      },
      foreignCurrency: {
        type: Sequelize.STRING
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'normal'
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'unmatched'
      },
      memo: {
        type: Sequelize.STRING
      },
      crossSlipDetailId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'CrossSlipDetails',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
      expenseReportLineId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'ExpenseReportLines',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
    await queryInterface.dropTable('BankStatementLines');
    await queryInterface.dropTable('BankStatements');
  }
};
