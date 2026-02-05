const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EvaluationGrid = sequelize.define('EvaluationGrid', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  target_role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'employee'
  },
  periodicity: {
    type: DataTypes.ENUM('monthly', 'quarterly', 'annual', 'one_time'),
    defaultValue: 'quarterly'
  },
  is_weighted: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  is_active: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  }
}, {
  tableName: 'evaluation_grids',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = EvaluationGrid;
