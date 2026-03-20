const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');

dotenv.config();

const users = [
  {
    name: 'Admin User',
    email: 'admin@attendx.com',
    password: 'admin123',
    role: 'admin',
    department: 'Human Resources',
    designation: 'HR Manager',
  },
  {
    name: 'Rahul Verma',
    email: 'rahul@attendx.com',
    password: 'employee123',
    role: 'employee',
    department: 'Engineering',
    designation: 'Senior Developer',
  },
  {
    name: 'Anita Desai',
    email: 'anita@attendx.com',
    password: 'employee123',
    role: 'employee',
    department: 'Design',
    designation: 'UI/UX Lead',
  }
];

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Clear existing data
    await User.deleteMany();
    await LeaveBalance.deleteMany();
    
    console.log('Existing data cleared');

    for (const u of users) {
      const user = await User.create(u);
      
      // Create leave balance for each user
      await LeaveBalance.create({
        userId: user._id,
        year: new Date().getFullYear(),
      });
      
      console.log(`User created: ${u.name} (${u.role})`);
    }

    console.log('Seed data successfully inserted!');
    process.exit();
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
