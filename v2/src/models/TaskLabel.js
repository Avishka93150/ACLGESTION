const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TaskLabel = sequelize.define('TaskLabel', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  board_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'task_boards',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  color: {
    type: DataTypes.STRING(7),
    allowNull: false
  }
}, {
  tableName: 'task_labels',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = TaskLabel;
