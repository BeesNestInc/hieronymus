'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('VoucherClasses', {
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
      form: {
        type: Sequelize.STRING
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
    await queryInterface.bulkInsert('VoucherClasses', [
      {
        name: '受取請求書',
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '受取領収書',
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '差出請求書',
        displayOrder: 2,
        form: 'invoice',
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '差出領収書',
        displayOrder: 3,
        form: 'receipt',
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        name: '差出見積書',
        displayOrder: 4,
        form: 'estimate',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    await queryInterface.renameColumn('Vouchers', 'type', 'voucherClassId');
    await queryInterface.addConstraint('Vouchers', {
      fields: ['voucherClassId'],
      type: 'foreign key',
      name: 'Vouchers_voucherClassId_fkey',
      references: {
        table: 'VoucherClasses',
        field: 'id'
      },
      onDelete: 'set null',
      onUpdate: 'cascade',
      allowNull: true
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Vouchers', 'Vouchers_voucherClassId_fkey');
    await queryInterface.renameColumn('Vouchers', 'voucherClassId', 'type');
    await queryInterface.dropTable('VoucherClasses');
  }
};