'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Documents', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      issueDate: {
        type: Sequelize.DATEONLY
      },
      title: {
        type: Sequelize.STRING
      },
      descriptionType: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.TEXT
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
    await queryInterface.createTable('DocumentFiles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
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
      name: {
        type: Sequelize.STRING
      },
      mimeType: {
        type: Sequelize.STRING
      },
      body: {
        type: Sequelize.BLOB
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
    await queryInterface.dropTable('DocumentFiles');
    await queryInterface.dropTable('Documents');
  }
};