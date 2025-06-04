'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CompanyClasses', {
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
    await queryInterface.bulkInsert('CompanyClasses', [
      {
        name: '自社',
        displayOrder: 8,
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
      }, {
        name: '税金公共料金等',
        displayOrder: 7,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    await queryInterface.renameColumn('Companies', 'type', 'companyClassId');
    await queryInterface.addConstraint('Companies', {
      fields: ['companyClassId'],
      type: 'foreign key',
      name: 'Companies_companyClassId_fkey',
      references: {
        table: 'CompanyClasses',
        field: 'id'
      },
      onDelete: 'set null',
      onUpdate: 'cascade',
      allowNull: true
    });
    await queryInterface.addColumn('Companies', 'DUNS', {
			type: Sequelize.STRING
    });
    await queryInterface.addColumn('Companies', 'companyNo', {
			type: Sequelize.STRING
    });
    await queryInterface.addColumn('Companies', 'logoURL', {
			type: Sequelize.STRING
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Companies', 'logoURL');
    await queryInterface.removeColumn('Companies', 'DUNS');
    await queryInterface.removeColumn('Companies', 'companyNo');
    await queryInterface.removeConstraint('Companies', 'Companies_companyClassId_fkey')
    await queryInterface.dropTable('CompanyClasses');
    await queryInterface.renameColumn('Companies', 'companyClassId', 'type');
  }
};