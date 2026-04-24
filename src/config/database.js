import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "printemporium",
    });
  } catch (error) {
    throw error; // Let server.js handle it instead of killing the process
  }
};
