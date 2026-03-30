const mongoose = require('mongoose');

async function checkRoles() {
  await mongoose.connect('mongodb://buddy_admin:HeyBuddySecure123!@82.29.167.22:27017/staging_Heybuddy?authSource=admin');
  const Role = require('./models/Role');
  const roles = await Role.find({});
  console.log(roles);
  process.exit(0);
}
checkRoles();
