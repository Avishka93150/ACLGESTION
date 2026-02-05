const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TaskColumn = sequelize.define('TaskColumn', {
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
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'task_columns',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = TaskColumn;
