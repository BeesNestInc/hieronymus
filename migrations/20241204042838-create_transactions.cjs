'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('Tasks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      companyId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Companies',
          field: 'id'
        },
        allowNull: true,
        onDelete: 'set null',
        onUpdate: 'cascade'
      },
      issueDate: {
        type: Sequelize.DATEONLY
      },
      deliveryLimit: {
        type: Sequelize.DATEONLY
      },
      companyName: {
        type: Sequelize.STRING
      },
      chargeName: {
        type: Sequelize.STRING
      },
      zip: {
        type: Sequelize.STRING
      },
      address1: {
        type: Sequelize.STRING
      },
      address2: {
        type: Sequelize.STRING
      },
      subject: {
        type: Sequelize.STRING
      },
      paymentMethod: {
        type: Sequelize.STRING
      },
      amount: {
        type: Sequelize.DECIMAL(12)
      },
      tax: {
        type: Sequelize.DECIMAL(12)
      },
      taxClass: {
        type: Sequelize.INTEGER
      },
      documentId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Documents',
          field: 'id'
        },
        onDelete: 'cascade',
        onUpdate: 'cascade'
      },
      handledBy: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          field: 'id'
        },
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          field: 'id'
        },
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          field: 'id'
        },
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      endedAt: {
        type: Sequelize.DATEONLY
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
    await queryInterface.createTable('TaskDetails', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      taskId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Tasks',
          field: 'id'
        },
        onDelete: 'cascade',
        onUpdate: 'cascade'
      },
      lineNo: {
        type: Sequelize.INTEGER
      },
      itemId: {
        type: Sequelize.INTEGER
      },
      itemName: {
        type: Sequelize.TEXT
      },
      itemSpec: {
        type: Sequelize.TEXT
      },
      unitPrice: {
        type: Sequelize.DECIMAL(12)
      },
      itemNumber: {
        type: Sequelize.DECIMAL(8,2)
      },
      unit: {
        type: Sequelize.STRING
      },
      amount: {
        type: Sequelize.DECIMAL(12)
      },
      description: {
        type: Sequelize.TEXT
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
    await queryInterface.createTable('TransactionKinds', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      label: {
        type: Sequelize.STRING,
        allowNull: false
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      hasDetails: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      hasDocument: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      forCompany: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      forBook: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      bookId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'VoucherClasses',
          field: 'id'
        },
        allowNull: true,
        onDelete: 'set null',
        onUpdate: 'cascade'
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
    await queryInterface.bulkInsert('TransactionKinds', [
			{
        label: '見積',
        displayOrder: 0,
        hasDetails: true,
        hasDocument: 1,
        forCompany: true,
        bookId: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '注文請書',
        displayOrder: 1,
        hasDetails: true,
        hasDocument: 1,
        forCompany: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '納品',
        displayOrder: 2,
        hasDetails: true,
        hasDocument: 1,
        forCompany: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '請求',
        displayOrder: 3,
        hasDetails: true,
        hasDocument: 1,
        forCompany: true,
        forBook: true,
        bookId: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '領収',
        displayOrder: 4,
        hasDetails: true,
        hasDocument: 1,
        forCompany: true,
        forBook: true,
        bookId: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '議事録',
        displayOrder: 5,
        hasDetails: false,
        hasDocument: 2,
        forCompany: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '報告書',
        displayOrder: 6,
        hasDetails: false,
        hasDocument: 2,
        forCompany: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    await queryInterface.createTable('TransactionDocuments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      no: {
        type: Sequelize.STRING
      },
      kindId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'TransactionKinds',
          field: 'id'
        },
        allowNull: false,
        onDelete: 'set null',
        onUpdate: 'cascade'
      },
      issueDate: {
        type: Sequelize.DATEONLY
      },
      deliveryLimit: {
        type: Sequelize.DATEONLY
      },
      companyId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Companies',
          field: 'id'
        },
        allowNull: true,
        onDelete: 'set null',
        onUpdate: 'cascade'
      },
      taskId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Tasks',
          field: 'id'
        },
        allowNull: true,
        onDelete: 'set null',
        onUpdate: 'cascade'
      },
      companyName: {
        type: Sequelize.STRING
      },
      chargeName: {
        type: Sequelize.STRING
      },
      zip: {
        type: Sequelize.STRING
      },
      address1: {
        type: Sequelize.STRING
      },
      address2: {
        type: Sequelize.STRING
      },
      subject: {
        type: Sequelize.STRING
      },
      paymentMethod: {
        type: Sequelize.STRING
      },
      amount: {
        type: Sequelize.DECIMAL(12)
      },
      tax: {
        type: Sequelize.DECIMAL(12)
      },
      taxClass: {
        type: Sequelize.INTEGER
      },
      description: {
        type: Sequelize.TEXT
      },
      documentId: {
        allowNull: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'Documents',
          field: 'id'
        },
        onDelete: 'cascade',
        onUpdate: 'cascade'
      },
      voucherId: {
				allowNull: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'Vouchers',
          field: 'id'
        }
      },
      handledBy: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          field: 'id'
        },
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          field: 'id'
        },
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          field: 'id'
        },
        onDelete: 'restrict',
        onUpdate: 'cascade'
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
    await queryInterface.createTable('TransactionDetails', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      transactionDocumentId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'TransactionDocuments',
          field: 'id'
        },
        onDelete: 'cascade',
        onUpdate: 'cascade'
      },
      lineNo: {
        type: Sequelize.INTEGER
      },
      itemId: {
        type: Sequelize.INTEGER
      },
      itemName: {
        type: Sequelize.TEXT
      },
      itemSpec: {
        type: Sequelize.TEXT
      },
      unitPrice: {
        type: Sequelize.DECIMAL(12)
      },
      itemNumber: {
        type: Sequelize.DECIMAL(8,2)
      },
      unit: {
        type: Sequelize.STRING
      },
      amount: {
        type: Sequelize.DECIMAL(12)
      },
      description: {
        type: Sequelize.TEXT
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

    await queryInterface.addColumn('FiscalYears', 'transactionCount', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('FiscalYears', 'transactionCount');
    await queryInterface.dropTable('TransactionDetails');
    await queryInterface.dropTable('TransactionDocuments');
    await queryInterface.dropTable('TransactionKinds');
    await queryInterface.dropTable('TaskDetails');
    await queryInterface.dropTable('Tasks');
  }
};
