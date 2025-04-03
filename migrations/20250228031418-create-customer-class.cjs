'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CustomerClasses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isClient: {
        type: Sequelize.BOOLEAN,
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
    await queryInterface.bulkInsert('CustomerClasses', [
      {
        name: '税金公共料金等',
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '国内購買先',
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '海外購買先',
        displayOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '国内外注',
        displayOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '海外外注',
        displayOrder: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '国内顧客',
        displayOrder: 5,
        isClient: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '海外顧客',
        displayOrder: 6,
        isClient: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    await queryInterface.renameColumn('Customers', 'type', 'customerClassId');
    await queryInterface.addConstraint('Customers', {
      fields: ['customerClassId'],
      type: 'foreign key',
      name: 'Customers_customerClassId_fkey',
      references: {
        table: 'CustomerClasses',
        field: 'id'
      },
      onDelete: 'set null',
      onUpdate: 'cascade',
      allowNull: true
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Customers', 'Customers_customerClassId_fkey')
    await queryInterface.dropTable('CustomerClasses');
    await queryInterface.renameColumn('Customers', 'customerClassId', 'type');
  }
};