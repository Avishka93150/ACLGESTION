const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Room = sequelize.define('Room', {
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
  room_number: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  floor: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  room_type: {
    type: DataTypes.ENUM('standard', 'superieure', 'suite', 'familiale', 'pmr'),
    defaultValue: 'standard'
  },
  bed_type: {
    type: DataTypes.ENUM('single', 'double', 'twin', 'king', 'queen'),
    defaultValue: 'double'
  },
  status: {
    type: DataTypes.ENUM('active', 'hors_service', 'renovation'),
    defaultValue: 'active'
  }
}, {
  tableName: 'rooms',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['hotel_id', 'room_number'],
      name: 'unique_room'
    }
  ]
});

module.exports = Room;
