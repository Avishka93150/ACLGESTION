#!/usr/bin/env node
/**
 * ACL GESTION v2 - Migration runner Sequelize
 *
 * Synchronise les modeles Sequelize avec la base de donnees.
 * En production, utiliser avec precaution (prefer sequelize-cli pour les migrations complexes).
 *
 * Usage:
 *   node src/migrations/run.js                # Sync (safe - ajoute les colonnes manquantes)
 *   node src/migrations/run.js --force        # Drop & recreate toutes les tables (DESTRUCTIF)
 *   node src/migrations/run.js --alter        # Alter les tables existantes pour matcher les modeles
 *   node src/migrations/run.js --status       # Afficher l'etat des tables
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ALTER = args.includes('--alter');
const STATUS = args.includes('--status');

async function run() {
  const { sequelize } = require('../models');

  console.log('=== ACL GESTION v2 - Migrations ===\n');
  console.log(`Base: ${process.env.DB_NAME || 'acl_gestion'}@${process.env.DB_HOST || 'localhost'}`);
  console.log(`Mode: ${FORCE ? 'FORCE (drop & recreate)' : ALTER ? 'ALTER (modifier tables)' : STATUS ? 'STATUS' : 'SYNC (safe)'}\n`);

  try {
    await sequelize.authenticate();
    console.log('Connexion OK\n');

    if (STATUS) {
      // Afficher l'etat des tables
      const [tables] = await sequelize.query('SHOW TABLES');
      console.log('Tables existantes:');
      for (const row of tables) {
        const tableName = Object.values(row)[0];
        const [[{ count }]] = await sequelize.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        console.log(`  ${tableName.padEnd(30)} ${count} lignes`);
      }
      await sequelize.close();
      return;
    }

    if (FORCE) {
      console.log('ATTENTION: Toutes les tables vont etre supprimees et recreees !');
      console.log('Les donnees seront PERDUES. Ctrl+C pour annuler...');
      await new Promise(r => setTimeout(r, 3000));
    }

    // Sync
    await sequelize.sync({
      force: FORCE,
      alter: ALTER
    });

    console.log('\nTables synchronisees avec succes.');

    // Afficher le resultat
    const [tables] = await sequelize.query('SHOW TABLES');
    console.log(`\n${tables.length} tables dans la base :`);
    for (const row of tables) {
      console.log(`  - ${Object.values(row)[0]}`);
    }

    await sequelize.close();
    console.log('\nMigration terminee.');
    process.exit(0);
  } catch (error) {
    console.error('ERREUR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
