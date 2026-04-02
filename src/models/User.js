import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  image: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  role: { type: String, default: "user" },
  banned: { type: Boolean, default: false },
  // ... other fields managed by better-auth
}, { strict: false }); // strict: false allows other fields to exist without schema definition

export default mongoose.model("User", userSchema, "user"); // Explicitly map to "user" collection
