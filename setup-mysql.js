const mysql = require('mysql2/promise');

async function setupDatabase() {
  try {
    // Connect to MySQL server (without specifying database)
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '' // Try with no password first
    });

    console.log('Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.execute('CREATE DATABASE IF NOT EXISTS homebonzenga');
    console.log('Database "homebonzenga" created or already exists');

    // Create a test user for authentication
    await connection.execute('USE homebonzenga');
    
    // Create users table manually for quick setup
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(191) PRIMARY KEY,
        email VARCHAR(191) UNIQUE NOT NULL,
        phone VARCHAR(191),
        password VARCHAR(191) NOT NULL,
        firstName VARCHAR(191) NOT NULL,
        lastName VARCHAR(191) NOT NULL,
        role ENUM('CUSTOMER', 'VENDOR', 'BEAUTICIAN', 'ADMIN') DEFAULT 'CUSTOMER',
        status ENUM('ACTIVE', 'SUSPENDED', 'PENDING') DEFAULT 'ACTIVE',
        avatar VARCHAR(191),
        fcmToken VARCHAR(191),
        createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      )
    `);

    console.log('Users table created');

    // Insert test admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    
    await connection.execute(`
      INSERT IGNORE INTO users (id, email, password, firstName, lastName, role, status) 
      VALUES ('admin-test-id', 'admin@homebonzenga.com', ?, 'Admin', 'User', 'ADMIN', 'ACTIVE')
    `, [hashedPassword]);

    console.log('Test admin user created');
    console.log('Email: admin@homebonzenga.com');
    console.log('Password: Admin@123');

    await connection.end();
    console.log('Database setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
