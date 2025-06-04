/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ItemClasses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      name: {
        type: Sequelize.STRING
      },
      product: {
        type: Sequelize.BOOLEAN
      },
      inventoryManagement: {
        type: Sequelize.BOOLEAN
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
    await queryInterface.bulkInsert('ItemClasses', [
      {
        displayOrder: 0,
        name: 'サービス(無形物)',
        product: true,
        inventoryManagement: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        displayOrder: 1,
        name: '商品(有形物)',
        product: true,
        inventoryManagement: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    await queryInterface.createTable('Items', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      itemClassId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'ItemClasses',
          field: 'id'
        },
        onDelete: 'cascade',
        onUpdate: 'cascade'
      },
      key: {
        type: Sequelize.STRING
      },
      globalCode: {
        type: Sequelize.STRING
      },
      storageCode: {
        type: Sequelize.STRING
      },
      localCode: {
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING
      },
      normalName: {
        type: Sequelize.STRING
      },
      spec: {
        type: Sequelize.STRING
      },
      standardPrice: {
        type: Sequelize.DECIMAL(8)
      },
      costPrice: {
        type: Sequelize.DECIMAL(8)
      },
      unit: {
        type: Sequelize.STRING
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
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Items');
    await queryInterface.dropTable('ItemClasses');
  }
};