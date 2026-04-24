import User from '../models/User.js';
import { getAuth } from '../lib/auth.js';

export const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });

    if (adminExists) {
      // Ensure the user has admin role
      if (adminExists.role !== 'admin') {
        await User.findByIdAndUpdate(adminExists._id, {
          role: 'admin',
          emailVerified: true
        });
      }
      return adminExists;
    }

    // Create admin user using Better Auth
    const auth = getAuth();
    const result = await auth.api.signUpEmail({
      body: {
        name: process.env.ADMIN_NAME || 'System Administrator',
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        isActive: true
      }
    });

    // Update user to admin role
    const adminUser = await User.findOne({ email: process.env.ADMIN_EMAIL });
    
    adminUser.role = 'admin';
    adminUser.emailVerified = true;
    await adminUser.save();

    return result.user;
  } catch (error) {
    // If user already exists, just log and continue
    if (error.message?.includes('already taken') || error.message?.includes('already exists')) {
      const adminUser = await User.findOne({ email: process.env.ADMIN_EMAIL });

      // Ensure admin role
      if (adminUser && adminUser.role !== 'admin') {
        await User.findByIdAndUpdate(adminUser._id, {
          role: 'admin',
          emailVerified: true
        });
      }
      
      return adminUser;
    }
    
    throw error;
  }
};
