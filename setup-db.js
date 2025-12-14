// Database setup script
require('./config.js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');
    
    // Generate Prisma client
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma client generated');
    
    // Push schema to database
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('✅ Database schema pushed');
    
    // Create a test customer user
    const testCustomer = await prisma.user.upsert({
      where: { email: 'customer@test.com' },
      update: {},
      create: {
        email: 'customer@test.com',
        firstName: 'Test',
        lastName: 'Customer',
        phone: '+1234567890',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5.5.2' // password: test123
      }
    });
    console.log('✅ Test customer created:', testCustomer.email);
    
    // Create a test vendor user
    const testVendor = await prisma.user.upsert({
      where: { email: 'vendor@test.com' },
      update: {},
      create: {
        email: 'vendor@test.com',
        firstName: 'Test',
        lastName: 'Vendor',
        phone: '+1234567891',
        role: 'VENDOR',
        status: 'ACTIVE',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5.5.2' // password: test123
      }
    });
    console.log('✅ Test vendor created:', testVendor.email);
    
    console.log('🎉 Database setup completed successfully!');
    console.log('\n📝 Test accounts created:');
    console.log('   Customer: customer@test.com / test123');
    console.log('   Vendor: vendor@test.com / test123');
    console.log('\n🔐 Static accounts:');
    console.log('   Admin: admin@homebonzenga.com / Admin@123');
    console.log('   Manager: manager@homebonzenga.com / Manager@123');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();

