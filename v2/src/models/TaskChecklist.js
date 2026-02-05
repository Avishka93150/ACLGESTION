const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TaskChecklist = sequelize.define('TaskChecklist', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  task_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'tasks',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  is_completed: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'task_checklists',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = TaskChecklist;
