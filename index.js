/**
 * 🚀 HOSTINGER DIAGNOSTIC STARTER
 * This file acts as the primary entry point for Hostinger Node.js deployments.
 * It provides better error reporting and resilience than a direct server start.
 */

import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// simple startup diagnostic
app.get("/", (req, res) => {
  res.send(`
    <style>body { font-family: sans-serif; padding: 40px; line-height: 1.6; background: #f4f7f9; }</style>
    <h1>PrintEmporium Backend Status</h1>
    <p>✅ <strong>Node.js:</strong> Alive (${process.version})</p>
    <p>⏱️ <strong>Uptime:</strong> ${Math.floor(process.uptime())}s</p>
    <p>📡 <strong>Database:</strong> ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting/Disconnected'}</p>
    <hr/>
    <p><em>Use /health for JSON status</em></p>
  `);
});

// Import the main server application
async function start() {
  console.log("🚀 Starting PrintEmporium Diagnostic Loader...");
  
  try {
    // Dynamically import the main server
    // This allows the starter to stay alive even if the main app has a syntax or import error
    const { default: serverApp } = await import("./server.js");
    console.log("✅ Main server.js loaded successfully");
  } catch (err) {
    console.error("❌ CRITICAL ERROR DURING STARTUP:", err);
    
    // Create a temporary error reporting server so the user sees the error in their browser
    // instead of a 503 error page.
    app.get("*", (req, res) => {
      res.status(500).send(`
        <h1 style="color: red;">CRITICAL STARTUP ERROR</h1>
        <pre style="background: #eee; padding: 20px; border-radius: 8px;">${err.stack}</pre>
        <p><strong>Common Solutions for Hostinger:</strong></p>
        <ul>
          <li>Whitelist Hostinger Server IP in MongoDB Atlas</li>
          <li>Check if all environment variables are set in Hostinger Panel</li>
          <li>Update npm packages if a dependency is missing</li>
        </ul>
      `);
    });
    
    app.listen(PORT, () => {
      console.log(`⚠️ Diagnostic error server running on port ${PORT}`);
    });
  }
}

start();
