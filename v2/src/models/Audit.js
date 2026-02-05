const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Audit = sequelize.define('Audit', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  grid_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'audit_grids',
      key: 'id'
    }
  },
  hotel_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'hotels',
      key: 'id'
    }
  },
  auditor_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  planned_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  actual_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'in_progress', 'completed', 'validated'),
    defaultValue: 'draft'
  },
  score: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true
  },
  weighted_score: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true
  },
  global_comment: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'audits',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Audit;
