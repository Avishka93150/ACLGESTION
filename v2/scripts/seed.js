#!/usr/bin/env node
/**
 * ACL GESTION v2 - Seed de la base de donnees
 * Cree les donnees initiales (admin, permissions, hotel demo)
 *
 * Usage: node scripts/seed.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');

async function seed() {
  // Charger les modeles apres dotenv
  const { sequelize, User, Hotel, Room, UserHotel, RolePermission, SystemConfig } = require('../src/models');

  console.log('=== ACL GESTION v2 - Seed ===\n');

  try {
    await sequelize.authenticate();
    console.log('Connexion DB OK\n');

    // Sync les tables (force: false = ne pas supprimer les donnees existantes)
    await sequelize.sync({ force: false });
    console.log('Tables synchronisees\n');

    // =============================================
    // 1. Admin par defaut
    // =============================================
    console.log('[1/5] Creation admin...');
    const [admin, adminCreated] = await User.findOrCreate({
      where: { email: 'admin@acl-gestion.fr' },
      defaults: {
        password: await bcrypt.hash('Admin@123', 10),
        first_name: 'Admin',
        last_name: 'ACL',
        role: 'admin',
        status: 'active',
        is_active: 1
      }
    });
    console.log(adminCreated ? '  Admin cree: admin@acl-gestion.fr / Admin@123' : '  Admin existe deja.');

    // =============================================
    // 2. Hotel demo
    // =============================================
    console.log('[2/5] Creation hotel demo...');
    const [hotel, hotelCreated] = await Hotel.findOrCreate({
      where: { name: 'Hotel Paris Centre' },
      defaults: {
        address: '15 Rue de Rivoli',
        city: 'Paris',
        postal_code: '75001',
        phone: '01 42 36 00 00',
        email: 'contact@hotel-paris-centre.fr',
        stars: 4,
        total_floors: 6,
        checkin_time: '15:00:00',
        checkout_time: '11:00:00',
        status: 'active'
      }
    });
    console.log(hotelCreated ? '  Hotel demo cree.' : '  Hotel demo existe deja.');

    // Associer admin a l'hotel
    await UserHotel.findOrCreate({
      where: { user_id: admin.id, hotel_id: hotel.id },
      defaults: { user_id: admin.id, hotel_id: hotel.id }
    });

    // =============================================
    // 3. Chambres demo
    // =============================================
    console.log('[3/5] Creation chambres demo...');
    const demoRooms = [
      { room_number: '101', floor: 1, room_type: 'standard', bed_type: 'double' },
      { room_number: '102', floor: 1, room_type: 'standard', bed_type: 'twin' },
      { room_number: '103', floor: 1, room_type: 'superieure', bed_type: 'double' },
      { room_number: '201', floor: 2, room_type: 'standard', bed_type: 'double' },
      { room_number: '202', floor: 2, room_type: 'familiale', bed_type: 'king' },
      { room_number: '301', floor: 3, room_type: 'superieure', bed_type: 'queen' },
      { room_number: '302', floor: 3, room_type: 'suite', bed_type: 'king' },
      { room_number: '401', floor: 4, room_type: 'suite', bed_type: 'king' },
      { room_number: '402', floor: 4, room_type: 'pmr', bed_type: 'double' }
    ];

    let roomsCreated = 0;
    for (const room of demoRooms) {
      const [, created] = await Room.findOrCreate({
        where: { hotel_id: hotel.id, room_number: room.room_number },
        defaults: { ...room, hotel_id: hotel.id, status: 'active' }
      });
      if (created) roomsCreated++;
    }
    console.log(`  ${roomsCreated} chambre(s) creee(s).`);

    // =============================================
    // 4. Permissions par defaut
    // =============================================
    console.log('[4/5] Creation permissions par defaut...');
    const allPermissions = [
      'hotels.view', 'hotels.create', 'hotels.edit', 'hotels.delete', 'rooms.manage',
      'users.view', 'users.manage',
      'dispatch.view', 'dispatch.create', 'dispatch.complete', 'dispatch.control',
      'linen.view', 'linen.manage', 'linen.config',
      'leaves.view', 'leaves.create', 'leaves.validate', 'leaves.manage_all',
      'maintenance.view', 'maintenance.create', 'maintenance.manage', 'maintenance.comment',
      'tasks.view', 'tasks.create', 'tasks.manage', 'tasks.assign',
      'evaluations.view', 'evaluations.grids', 'evaluations.evaluate', 'evaluations.view_own',
      'audit.view', 'audit.grids', 'audit.execute', 'audit.view_results',
      'closures.view', 'closures.create', 'closures.validate', 'closures.edit_all', 'closures.add_remise', 'closures.add_comment',
      'messages.access', 'messages.broadcast', 'notifications.receive',
      'dashboard.view', 'dashboard.global', 'reports.access', 'reports.export',
      'permissions.manage'
    ];

    const rolePermissions = {
      admin: allPermissions,
      groupe_manager: allPermissions.filter(p => !['permissions.manage', 'users.manage'].includes(p)),
      hotel_manager: [
        'hotels.view', 'rooms.manage', 'users.view',
        'dispatch.view', 'dispatch.create', 'dispatch.complete', 'dispatch.control',
        'linen.view', 'linen.manage',
        'leaves.view', 'leaves.create', 'leaves.validate',
        'maintenance.view', 'maintenance.create', 'maintenance.manage', 'maintenance.comment',
        'tasks.view', 'tasks.create', 'tasks.manage', 'tasks.assign',
        'evaluations.view', 'evaluations.evaluate', 'evaluations.view_own',
        'audit.view', 'audit.execute', 'audit.view_results',
        'closures.view', 'closures.create',
        'messages.access', 'notifications.receive',
        'dashboard.view', 'reports.access'
      ],
      rh: [
        'hotels.view', 'users.view',
        'leaves.view', 'leaves.create', 'leaves.validate', 'leaves.manage_all',
        'evaluations.view', 'evaluations.grids', 'evaluations.evaluate', 'evaluations.view_own',
        'messages.access', 'notifications.receive',
        'dashboard.view'
      ],
      comptabilite: [
        'hotels.view',
        'linen.view',
        'closures.view', 'closures.create', 'closures.validate', 'closures.edit_all', 'closures.add_remise', 'closures.add_comment',
        'messages.access', 'notifications.receive',
        'dashboard.view', 'reports.access', 'reports.export'
      ],
      receptionniste: [
        'hotels.view',
        'dispatch.view', 'dispatch.create',
        'maintenance.view', 'maintenance.create', 'maintenance.comment',
        'linen.view',
        'tasks.view',
        'leaves.view', 'leaves.create',
        'messages.access', 'notifications.receive',
        'dashboard.view'
      ],
      employee: [
        'dispatch.view', 'dispatch.complete',
        'maintenance.view', 'maintenance.create', 'maintenance.comment',
        'tasks.view',
        'leaves.view', 'leaves.create',
        'evaluations.view_own',
        'messages.access', 'notifications.receive',
        'dashboard.view'
      ]
    };

    let permCreated = 0;
    for (const [role, perms] of Object.entries(rolePermissions)) {
      for (const perm of perms) {
        const [, created] = await RolePermission.findOrCreate({
          where: { role, permission: perm },
          defaults: { role, permission: perm, allowed: 1 }
        });
        if (created) permCreated++;
      }
    }
    console.log(`  ${permCreated} permission(s) creee(s).`);

    // =============================================
    // 5. Config systeme
    // =============================================
    console.log('[5/5] Configuration systeme...');
    const configs = [
      ['app_name', 'ACL GESTION'],
      ['app_version', '2.0.0'],
      ['maintenance_enabled', 'true'],
      ['dispatch_enabled', 'true'],
      ['linen_enabled', 'true'],
      ['leaves_enabled', 'true'],
      ['tasks_enabled', 'true'],
      ['evaluations_enabled', 'true'],
      ['audit_enabled', 'true'],
      ['closures_enabled', 'true'],
      ['revenue_enabled', 'true'],
      ['messages_enabled', 'true'],
      ['chatbot_enabled', 'true'],
      ['privacy_policy_date', new Date().toISOString()]
    ];

    let confCreated = 0;
    for (const [key, value] of configs) {
      const [, created] = await SystemConfig.findOrCreate({
        where: { setting_key: key },
        defaults: { setting_key: key, setting_value: value }
      });
      if (created) confCreated++;
    }
    console.log(`  ${confCreated} configuration(s) creee(s).`);

    console.log('\n=== SEED TERMINE ===\n');
    console.log('Identifiants admin:');
    console.log('  Email:    admin@acl-gestion.fr');
    console.log('  Mot de passe: Admin@123');
    console.log('  IMPORTANT: Changez ce mot de passe immediatement !\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('ERREUR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seed();
