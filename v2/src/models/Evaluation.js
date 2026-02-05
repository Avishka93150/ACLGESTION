const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Evaluation = sequelize.define('Evaluation', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  grid_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'evaluation_grids',
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
  evaluated_user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  evaluator_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  period_start: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  period_end: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'validated', 'archived'),
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
  },
  conclusion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  validated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'evaluations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Evaluation;
