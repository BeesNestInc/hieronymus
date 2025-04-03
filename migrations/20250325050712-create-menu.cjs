'use strict';
const menuTemplate = require('../config/menu-template.cjs');
let records = [];
for ( let i = 1 ; i <=  menuTemplate.length ; i+= 1 )  {
  let ent = menuTemplate[i-1];
  records.push({
    title: ent.title,
    userId: null,
    displayOrder: i,
    body: JSON.stringify(ent.menu),
    createdAt: new Date(),
    updatedAt: new Date()
  });
}
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Menus', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          field: 'id'
        },
        allowNull: true,            //  null is template
        onDelete: 'cascade',
        onUpdate: 'cascade'
      },
      title: {
        type: Sequelize.STRING
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0							//	zero is HOME
      },
      body: {
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
    await queryInterface.bulkInsert('Menus', records);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Menus');
  }
};