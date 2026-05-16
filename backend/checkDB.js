const mongoose = require('mongoose');

async function checkRoles() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI);
  const Role = require('./models/Role');
  const roles = await Role.find({});
  console.log(roles);
  process.exit(0);
}
checkRoles();
