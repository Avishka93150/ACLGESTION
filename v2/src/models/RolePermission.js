const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  permission: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  allowed: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  }
}, {
  tableName: 'role_permissions',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['role', 'permission'],
      name: 'unique_perm'
    }
  ]
});

module.exports = RolePermission;
