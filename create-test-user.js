const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    
    // Create test admin user
    const user = await prisma.user.create({
      data: {
        email: 'admin@homebonzenga.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });

    console.log('✅ Test admin user created successfully!');
    console.log('📧 Email: admin@homebonzenga.com');
    console.log('🔑 Password: Admin@123');
    console.log('👤 User ID:', user.id);
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ️  Admin user already exists');
    } else {
      console.error('❌ Error creating test user:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
