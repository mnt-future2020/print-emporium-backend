import Order from "../models/order.model.js";
import Service from "../models/Service.js";
import User from "../models/User.js";

const sampleCities = [
  "Mumbai",
  "Pune",
  "Delhi",
  "Bengaluru",
  "Hyderabad",
  "Kolkata",
  "Chennai",
];
const sampleStreets = [
  "MG Road",
  "Station Road",
  "Industrial Area",
  "Market Street",
  "Main Street",
  "Business Park",
];
const paymentMethods = [
  "cod",
  "online",
  "upi",
  "razorpay",
  "card",
  "netbanking",
  "wallet",
];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeNameEmail(i) {
  const names = [
    "Aisha",
    "Rohit",
    "Sneha",
    "Vikram",
    "Maya",
    "Arjun",
    "Nina",
    "Karan",
    "Zoya",
    "Dev",
  ];
  const name = names[i % names.length] + (i > names.length ? i : "");
  return { name, email: `${name.toLowerCase()}${i}@example.com` };
}

export const seedOrders = async (targetCount = 40) => {
  try {
    const existing = await Order.countDocuments();
    if (existing >= targetCount) {
      console.log("✅ Orders already seeded or enough orders present");
      return;
    }

    // Ensure multiple services exist (create a few sample ones if missing)
    let services = await Service.find().limit(10);
    if (!services || services.length === 0) {
      const created = await Service.create([
        { name: "Digital Print (A4)", basePricePerPage: 2 },
        { name: "Photo Print (4x6)", basePricePerPage: 5 },
        { name: "Booklet Binding", basePricePerPage: 10 },
      ]);
      services = created;
      console.log("   Created sample services for seeding orders");
    }

    // Ensure a pool of demo users exists
    let users = await User.find().limit(50);
    if (!users || users.length < 5) {
      const toCreate = [];
      for (let i = 0; i < 10; i++) {
        const u = makeNameEmail(i);
        toCreate.push({ name: u.name, email: u.email, emailVerified: true });
      }
      users = await User.create(toCreate);
      console.log("   Created demo users for seeding orders");
    }

    const toInsert = [];
    const need = targetCount - existing;
    for (let i = 0; i < need; i++) {
      const user = users[Math.floor(Math.random() * users.length)];

      // Possibly include multiple items in an order
      const itemCount =
        Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 2 : 1;
      const items = [];
      let subtotalSum = 0;

      for (let j = 0; j < itemCount; j++) {
        const service = services[Math.floor(Math.random() * services.length)];
        const copies = Math.floor(Math.random() * 4) + 1;
        const totalPages = Math.floor(Math.random() * 80) + 1;
        const basePricePerPage = service.basePricePerPage || 2;
        const pricePerPage = +(basePricePerPage + Math.random() * 4).toFixed(2);
        const itemSubtotal = +(pricePerPage * totalPages * copies).toFixed(2);

        subtotalSum += itemSubtotal;

        items.push({
          serviceId: service._id,
          serviceName: service.name,
          fileName: `file_${i}_${j}.pdf`,
          fileSize: totalPages * 2048,
          pageCount: totalPages,
          filePublicId:
            Math.random() > 0.6
              ? `raw_${Math.random().toString(36).slice(2, 10)}`
              : null,
          pdfPublicId:
            Math.random() > 0.6
              ? `pdf_${Math.random().toString(36).slice(2, 10)}`
              : null,
          configuration: {
            printType: Math.random() > 0.5 ? "color" : "bw",
            paperSize: rand(["A4", "A3", "Letter"]),
            paperType: rand(["Standard", "Glossy", "Matte"]),
            gsm: rand(["80", "100", "120"]),
            printSide: rand(["single", "double"]),
            bindingOption: rand(["none", "staple", "spiral"]),
            copies,
          },
          pricing: {
            basePricePerPage,
            printTypePrice: 0,
            paperSizePrice: 0,
            paperTypePrice: 0,
            gsmPrice: 0,
            printSidePrice: 0,
            bindingPrice: 0,
            pricePerPage,
            totalPages,
            copies,
            subtotal: itemSubtotal,
          },
        });
      }

      const deliveryCharge =
        subtotalSum > 500 ? 0 : Math.random() > 0.7 ? 60 : 30;
      const total = +(subtotalSum + deliveryCharge).toFixed(2);

      const paymentStatus =
        Math.random() > 0.5
          ? "paid"
          : Math.random() > 0.8
          ? "failed"
          : "pending";
      const status =
        paymentStatus === "paid"
          ? rand(["delivered", "shipped", "processing"])
          : rand(["pending", "confirmed", "cancelled"]);

      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date(
        Date.now() -
          daysAgo * 24 * 60 * 60 * 1000 -
          Math.floor(Math.random() * 86400000)
      );

      const orderNumber = `PE${String(createdAt.getFullYear()).slice(
        -2
      )}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(
        createdAt.getDate()
      ).padStart(2, "0")}${String(Math.floor(Math.random() * 9000) + 1000)}`;

      toInsert.push({
        orderNumber,
        userId: user._id,
        items,
        deliveryInfo: {
          fullName: user.name || "Customer",
          phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
          email: user.email || "customer@example.com",
          address: `${Math.floor(Math.random() * 200) + 1} ${rand(
            sampleStreets
          )}`,
          city: rand(sampleCities),
          state: "State",
          pincode: `${400000 + Math.floor(Math.random() * 9999)}`,
          deliveryNotes: Math.random() > 0.8 ? "Leave at reception" : "",
          scheduleDelivery: Math.random() > 0.9,
          scheduledDate: null,
        },
        pricing: {
          subtotal: +subtotalSum.toFixed(2),
          deliveryCharge,
          packingCharge: 0,
          total,
        },
        status,
        paymentStatus,
        paymentMethod: rand(paymentMethods),
        paymentId:
          paymentStatus === "paid"
            ? `pay_${Math.random().toString(36).substr(2, 9)}`
            : null,
        trackingNumber:
          status === "shipped" || status === "delivered"
            ? `TRK${Math.random().toString(36).substr(2, 9).toUpperCase()}`
            : null,
        estimatedDelivery: new Date(
          createdAt.getTime() +
            (2 + Math.floor(Math.random() * 7)) * 24 * 60 * 60 * 1000
        ),
        invoiceEmailSent: paymentStatus === "paid",
        invoiceEmailSentAt: paymentStatus === "paid" ? createdAt : null,
        notes:
          Math.random() > 0.85
            ? "Customer requested weekend delivery"
            : "Seeded order",
        createdAt,
        updatedAt: createdAt,
      });
    }

    const inserted = await Order.insertMany(toInsert);
    console.log(`✅ Seeded ${inserted.length} orders`);
  } catch (error) {
    console.error("❌ Error seeding orders:", error.message || error);
  }
};

export default seedOrders;
