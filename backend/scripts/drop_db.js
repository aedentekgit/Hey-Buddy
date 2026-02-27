const mongoose = require('mongoose');

async function dropDatabases() {
  const uri = 'mongodb://buddy_admin:HeyBuddySecure123!@localhost:27017/?authSource=admin';

  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully!");

    await mongoose.connection.useDb('buddy_production').dropDatabase();
    console.log("✅ buddy_production dropped.");

    await mongoose.connection.useDb('staging_Heybuddy').dropDatabase();
    console.log("✅ staging_Heybuddy dropped.");

    await mongoose.connection.useDb('test').dropDatabase();
    console.log("✅ test dropped.");

  } catch (error) {
    console.error("❌ Failed to drop databases:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

dropDatabases();
