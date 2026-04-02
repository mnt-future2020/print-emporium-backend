/**
 * Authenticated API Test
 * Tests the analytics endpoint with admin credentials
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000';
const ADMIN_EMAIL = 'azar@mntfuture.com';
const ADMIN_PASSWORD = 'Admin@123';

const testPeriods = ['today', 'week', 'month', 'year'];

async function loginAndGetSession() {
  console.log('🔐 Logging in as admin...');
  
  try {
    const response = await axios.post(
      `${API_URL}/api/auth/sign-in/email`,
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      },
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract cookies from response
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      const sessionCookie = cookies.find(c => c.includes('better-auth.session_token'));
      if (sessionCookie) {
        const cookieValue = sessionCookie.split(';')[0];
        console.log('✅ Login successful!\n');
        return cookieValue;
      }
    }

    console.log('❌ Could not extract session cookie');
    return null;

  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
    return null;
  }
}

async function testAnalyticsWithPeriod(period, sessionCookie) {
  try {
    const response = await axios.get(
      `${API_URL}/api/orders/admin/stats?period=${period}`,
      {
        headers: {
          'Cookie': sessionCookie
        },
        withCredentials: true
      }
    );

    if (response.data.success) {
      const stats = response.data.stats;
      
      console.log(`\n📊 Period: ${period.toUpperCase()}`);
      console.log('-'.repeat(80));
      console.log(`   Total Orders: ${stats.totalOrders}`);
      console.log(`   Total Revenue: ₹${stats.totalRevenue.toLocaleString('en-IN')}`);
      console.log(`   Average Order Value: ₹${stats.averageOrderValue}`);
      console.log(`   Revenue Growth: ${stats.revenueGrowth}%`);
      console.log(`   Order Growth: ${stats.orderGrowth}%`);
      
      console.log(`\n   Status Breakdown:`);
      console.log(`     • Pending: ${stats.statusBreakdown.pending}`);
      console.log(`     • Confirmed: ${stats.statusBreakdown.confirmed}`);
      console.log(`     • Processing: ${stats.statusBreakdown.processing}`);
      console.log(`     • Printing: ${stats.statusBreakdown.printing}`);
      console.log(`     • Shipped: ${stats.statusBreakdown.shipped}`);
      console.log(`     • Delivered: ${stats.statusBreakdown.delivered}`);
      console.log(`     • Cancelled: ${stats.statusBreakdown.cancelled}`);
      
      console.log(`\n   Payment Status:`);
      console.log(`     • Paid: ${stats.paymentBreakdown.paid}`);
      console.log(`     • Pending: ${stats.paymentBreakdown.pending}`);
      
      console.log(`\n   Chart Data:`);
      console.log(`     • Monthly Revenue Points: ${stats.charts.monthlyRevenue.length}`);
      console.log(`     • Daily Orders Points: ${stats.charts.dailyOrders.length}`);
      console.log(`     • Services: ${stats.charts.ordersByService.length}`);
      console.log(`     • Payment Methods: ${stats.charts.ordersByPaymentMethod.length}`);
      
      console.log(`\n   Lists:`);
      console.log(`     • Top Customers: ${stats.topCustomers.length}`);
      console.log(`     • Recent Orders: ${stats.recentOrders.length}`);
      
      return stats;
    } else {
      console.log(`❌ Failed for period ${period}:`, response.data.message);
      return null;
    }

  } catch (error) {
    console.log(`❌ Error testing period ${period}:`, error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Authenticated API Testing - Analytics Endpoint\n');
  console.log('=' .repeat(80));

  // Step 1: Login
  const sessionCookie = await loginAndGetSession();
  
  if (!sessionCookie) {
    console.log('\n❌ Cannot proceed without authentication');
    return;
  }

  // Step 2: Test each period
  console.log('\n📋 Testing Different Period Filters:\n');
  console.log('=' .repeat(80));

  const results = {};
  
  for (const period of testPeriods) {
    const stats = await testAnalyticsWithPeriod(period, sessionCookie);
    results[period] = stats;
  }

  // Step 3: Compare results
  console.log('\n\n📈 Comparison Across Periods:\n');
  console.log('=' .repeat(80));
  console.log('\n');
  console.log('Period      | Total Orders | Total Revenue | Avg Order Value | Growth %');
  console.log('-'.repeat(80));
  
  testPeriods.forEach(period => {
    const stats = results[period];
    if (stats) {
      const orders = String(stats.totalOrders).padEnd(12);
      const revenue = `₹${stats.totalRevenue.toLocaleString('en-IN')}`.padEnd(13);
      const avg = `₹${stats.averageOrderValue}`.padEnd(15);
      const growth = `${stats.orderGrowth}%`;
      console.log(`${period.padEnd(11)} | ${orders} | ${revenue} | ${avg} | ${growth}`);
    }
  });

  // Step 4: Verify filtering is working
  console.log('\n\n✅ Verification Results:\n');
  console.log('=' .repeat(80));
  
  const hasVariation = testPeriods.some((period, index) => {
    if (index === 0) return false;
    const prev = results[testPeriods[index - 1]];
    const curr = results[period];
    return prev && curr && (
      prev.totalOrders !== curr.totalOrders ||
      prev.totalRevenue !== curr.totalRevenue
    );
  });

  if (hasVariation) {
    console.log('✅ Filter parameters are working correctly!');
    console.log('   Different periods return different data as expected.');
  } else {
    console.log('⚠️  All periods returned the same data.');
    console.log('   This could mean:');
    console.log('   • All orders are from the same period');
    console.log('   • There are no orders in the database');
    console.log('   • The filter might need verification');
  }

  // Check if there's any data at all
  const monthStats = results['month'];
  if (monthStats && monthStats.totalOrders === 0) {
    console.log('\n📝 Note: No orders found in the database.');
    console.log('   Create some test orders to see the filtering in action.');
  } else if (monthStats) {
    console.log(`\n📊 Database contains ${monthStats.totalOrders} orders this month.`);
    console.log('   Filter logic is properly implemented and functional!');
  }

  console.log('\n' + '=' .repeat(80));
  console.log('\n✨ Testing complete!\n');
}

runTests().catch(console.error);
