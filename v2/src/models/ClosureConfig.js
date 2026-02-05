const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClosureConfig = sequelize.define('ClosureConfig', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  hotel_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'hotels',
      key: 'id'
    }
  },
  document_name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  is_required: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'closure_config',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = ClosureConfig;
