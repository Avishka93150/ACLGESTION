#!/usr/bin/env node
/**
 * ACL GESTION - Script de création d'administrateur
 * Usage: node create-admin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
}

async function main() {
    console.log('\n========================================');
    console.log('  ACL GESTION - Création Admin');
    console.log('========================================\n');

    // Collecter les informations
    const email = await question('Email: ');
    const password = await question('Mot de passe: ');
    const firstName = await question('Prénom: ');
    const lastName = await question('Nom: ');

    if (!email || !password || !firstName || !lastName) {
        console.error('\nErreur: Tous les champs sont requis');
        process.exit(1);
    }

    if (password.length < 6) {
        console.error('\nErreur: Le mot de passe doit faire au moins 6 caractères');
        process.exit(1);
    }

    try {
        // Connexion à la base de données
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        // Vérifier si l'email existe déjà
        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            console.error('\nErreur: Cet email existe déjà');
            await connection.end();
            process.exit(1);
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer l'utilisateur
        const [result] = await connection.execute(
            `INSERT INTO users (email, password, first_name, last_name, role, status, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'admin', 'active', 1, NOW(), NOW())`,
            [email, hashedPassword, firstName, lastName]
        );

        console.log('\n✅ Administrateur créé avec succès!');
        console.log(`   ID: ${result.insertId}`);
        console.log(`   Email: ${email}`);
        console.log(`   Nom: ${firstName} ${lastName}`);
        console.log('\nVous pouvez maintenant vous connecter sur https://app.acl-gestion.com\n');

        await connection.end();
    } catch (error) {
        console.error('\nErreur:', error.message);
        process.exit(1);
    }

    rl.close();
}

main();
