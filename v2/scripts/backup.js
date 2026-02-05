#!/usr/bin/env node
/**
 * ACL GESTION - Script de backup complet (PHP v1)
 *
 * Sauvegarde la base de donnees MySQL + les fichiers uploads
 * dans une archive horodatee.
 *
 * Usage: node scripts/backup.js [--output /chemin/backup]
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Charger .env si present
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}

const DB_HOST = process.env.PHP_DB_HOST || process.env.DB_HOST || 'localhost';
const DB_NAME = process.env.PHP_DB_NAME || process.env.DB_NAME || 'acl_gestion';
const DB_USER = process.env.PHP_DB_USER || process.env.DB_USER || 'root';
const DB_PASS = process.env.PHP_DB_PASS || process.env.DB_PASS || '';
const UPLOAD_DIR = process.env.PHP_UPLOAD_DIR || process.env.UPLOAD_DIR || '/var/www/acl-gestion.com/uploads';

// Dossier de sortie
let outputDir = path.join(__dirname, '..', 'backups');
const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
if (outputIdx !== -1 && args[outputIdx + 1]) {
  outputDir = args[outputIdx + 1];
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = path.join(outputDir, `backup-${timestamp}`);

console.log('=== ACL GESTION - Backup Complet ===');
console.log(`Date:        ${new Date().toLocaleString('fr-FR')}`);
console.log(`Base:        ${DB_NAME}@${DB_HOST}`);
console.log(`Uploads:     ${UPLOAD_DIR}`);
console.log(`Destination: ${backupDir}`);
console.log('');

try {
  // Creer le dossier de backup
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(path.join(backupDir, 'sql'), { recursive: true });

  // ================================================
  // 1. Dump de la base de donnees
  // ================================================
  console.log('[1/4] Export de la base de donnees...');
  const sqlFile = path.join(backupDir, 'sql', `${DB_NAME}-${timestamp}.sql`);
  const passArg = DB_PASS ? `-p'${DB_PASS}'` : '';

  // Dump structure
  execSync(
    `mysqldump -h ${DB_HOST} -u ${DB_USER} ${passArg} --no-data --routines --triggers ${DB_NAME} > "${path.join(backupDir, 'sql', 'schema.sql')}"`,
    { stdio: 'pipe', shell: true }
  );
  console.log('  Schema exporte.');

  // Dump data complet
  execSync(
    `mysqldump -h ${DB_HOST} -u ${DB_USER} ${passArg} --complete-insert --single-transaction --quick ${DB_NAME} > "${sqlFile}"`,
    { stdio: 'pipe', shell: true }
  );
  const sqlSize = (fs.statSync(sqlFile).size / 1024 / 1024).toFixed(2);
  console.log(`  Donnees exportees: ${sqlSize} Mo`);

  // ================================================
  // 2. Export table par table (pour migration granulaire)
  // ================================================
  console.log('[2/4] Export table par table...');
  const tablesDir = path.join(backupDir, 'sql', 'tables');
  fs.mkdirSync(tablesDir, { recursive: true });

  // Lister les tables
  const tablesOutput = execSync(
    `mysql -h ${DB_HOST} -u ${DB_USER} ${passArg} -N -e "SHOW TABLES" ${DB_NAME}`,
    { encoding: 'utf-8', shell: true }
  );
  const tables = tablesOutput.trim().split('\n').filter(t => t.trim());

  for (const table of tables) {
    const tableName = table.trim();
    execSync(
      `mysqldump -h ${DB_HOST} -u ${DB_USER} ${passArg} --complete-insert --single-transaction ${DB_NAME} ${tableName} > "${path.join(tablesDir, `${tableName}.sql`)}"`,
      { stdio: 'pipe', shell: true }
    );
  }
  console.log(`  ${tables.length} tables exportees individuellement.`);

  // Export en JSON pour migration Node.js
  console.log('[2b/4] Export JSON pour migration...');
  const jsonDir = path.join(backupDir, 'json');
  fs.mkdirSync(jsonDir, { recursive: true });

  for (const table of tables) {
    const tableName = table.trim();
    try {
      const jsonData = execSync(
        `mysql -h ${DB_HOST} -u ${DB_USER} ${passArg} -N -e "SELECT JSON_ARRAYAGG(JSON_OBJECT(*)) FROM (SELECT * FROM \\\`${tableName}\\\`) t" ${DB_NAME} 2>/dev/null || mysql -h ${DB_HOST} -u ${DB_USER} ${passArg} -B -e "SELECT * FROM \\\`${tableName}\\\`" ${DB_NAME}`,
        { encoding: 'utf-8', shell: true, maxBuffer: 100 * 1024 * 1024 }
      );

      // Si c'est du JSON natif (MySQL 5.7+)
      if (jsonData.trim().startsWith('[')) {
        fs.writeFileSync(path.join(jsonDir, `${tableName}.json`), jsonData.trim());
      } else {
        // Convertir TSV en JSON
        const lines = jsonData.trim().split('\n');
        if (lines.length > 0) {
          const headers = lines[0].split('\t');
          const rows = [];
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('\t');
            const row = {};
            headers.forEach((h, idx) => {
              row[h] = values[idx] === 'NULL' ? null : values[idx];
            });
            rows.push(row);
          }
          fs.writeFileSync(path.join(jsonDir, `${tableName}.json`), JSON.stringify(rows, null, 2));
        }
      }
    } catch (e) {
      console.warn(`  Avertissement: ${tableName} - ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`  Export JSON termine.`);

  // ================================================
  // 3. Copier les fichiers uploads
  // ================================================
  console.log('[3/4] Copie des fichiers uploads...');
  const uploadsBackup = path.join(backupDir, 'uploads');

  if (fs.existsSync(UPLOAD_DIR)) {
    execSync(`cp -r "${UPLOAD_DIR}" "${uploadsBackup}"`, { shell: true });
    // Compter les fichiers
    const fileCount = execSync(`find "${uploadsBackup}" -type f | wc -l`, { encoding: 'utf-8', shell: true }).trim();
    console.log(`  ${fileCount} fichiers copies.`);
  } else {
    fs.mkdirSync(uploadsBackup, { recursive: true });
    console.log(`  Repertoire uploads source non trouve (${UPLOAD_DIR}). Dossier vide cree.`);
  }

  // ================================================
  // 4. Creer l'archive
  // ================================================
  console.log('[4/4] Creation de l\'archive...');
  const archiveName = `acl-gestion-backup-${timestamp}.tar.gz`;
  const archivePath = path.join(outputDir, archiveName);

  execSync(`tar -czf "${archivePath}" -C "${outputDir}" "backup-${timestamp}"`, { shell: true });
  const archiveSize = (fs.statSync(archivePath).size / 1024 / 1024).toFixed(2);

  // Nettoyer le dossier temporaire (garder l'archive)
  execSync(`rm -rf "${backupDir}"`, { shell: true });

  console.log('');
  console.log('=== BACKUP TERMINE ===');
  console.log(`Archive: ${archivePath}`);
  console.log(`Taille:  ${archiveSize} Mo`);
  console.log(`Tables:  ${tables.length}`);
  console.log('');
  console.log('Pour restaurer:');
  console.log(`  tar -xzf ${archiveName}`);
  console.log(`  mysql -u USER -p ${DB_NAME} < sql/${DB_NAME}-${timestamp}.sql`);
  console.log(`  cp -r uploads/* /chemin/uploads/`);

} catch (error) {
  console.error('');
  console.error('ERREUR BACKUP:', error.message);
  console.error('');
  console.error('Verifiez:');
  console.error('  - mysqldump est installe');
  console.error('  - Les identifiants DB dans .env sont corrects');
  console.error('  - Le dossier de destination est accessible en ecriture');
  process.exit(1);
}
