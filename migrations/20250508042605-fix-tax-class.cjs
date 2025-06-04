'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('TaxRules', {
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
      taxClass: {
        type: Sequelize.INTEGER,
        defaultValue: 2
      },
      rate: {   //  in per-cent
        type: Sequelize.INTEGER,
        defaultValue: 0
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

    await queryInterface.bulkInsert('TaxRules', [
      {
        label: '非課税',
        displayOrder: 0,
        taxClass: 0,
        startDate: '2019-10-01',
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '内税 10%',
        displayOrder: 3,
        taxClass: 1,
        rate: 10,
        startDate: '2019-10-01',
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '外税 10%',
        displayOrder: 4,
        taxClass: 2,
        rate: 10,
        startDate: '2019-10-01',
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '内税 軽減(8%)',
        displayOrder: 3,
        taxClass: 1,
        rate: 8,
        startDate: '2019-10-01',
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '外税 軽減(8%)',
        displayOrder: 2,
        taxClass: 2,
        rate: 8,
        startDate: '2019-10-01',
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        label: '非課税',
        displayOrder: 5,
        taxClass: 9,
        startDate: '2019-10-01',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    await queryInterface.addColumn('CrossSlipDetails', 'debitTaxRuleId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'TaxRules',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT'
    });
    await queryInterface.addColumn('CrossSlipDetails', 'creditTaxRuleId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'TaxRules',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT'
    });

    await queryInterface.removeColumn('Vouchers', 'taxClass');
    await queryInterface.addColumn('Vouchers', 'taxRuleId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'TaxRules',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT'
    })
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    //await queryInterface.removeConstraint('Vouchers', 'Vouchers_taxRuleId_fkey');
    //await queryInterface.renameColumn('Vouchers', 'taxRuleId', 'taxClass');
    await queryInterface.removeConstraint('CrossSlipDetails', 'CrossSlipDetails_debitTaxRuleId_fkey');
    await queryInterface.removeConstraint('CrossSlipDetails', 'CrossSlipDetails_creditTaxRuleId_fkey');
    await queryInterface.removeColumn('CrossSlipDetails', 'debitTaxRuleId');
    await queryInterface.removeColumn('CrossSlipDetails', 'creditTaxRuleId');
    await queryInterface.removeConstraint('Vouchers', 'Vouchers_taxRuleId_fkey');
    await queryInterface.removeColumn('Vouchers', 'taxRuleId');
    await queryInterface.dropTable('TaxRules');
    await queryInterface.addColumn('Vouchers', 'taxClass', {
      type: Sequelize.INTEGER
    });
  }
};
