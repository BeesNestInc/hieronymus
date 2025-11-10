'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('TransactionDocuments', 'TransactionDocuments_voucherId_fkey');
    await queryInterface.addConstraint('TransactionDocuments', {
      fields: ['voucherId'],
      type: 'foreign key',
      name: 'TransactionDocuments_voucherId_fkey',
      references: {
        table: 'Vouchers',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('TransactionDocuments', 'TransactionDocuments_voucherId_fkey');
    await queryInterface.addConstraint('TransactionDocuments', {
      fields: ['voucherId'],
      type: 'foreign key',
      name: 'TransactionDocuments_voucherId_fkey',
      references: {
        table: 'Vouchers',
        field: 'id',
      },
      onUpdate: 'CASCADE',
    });
  }
};
