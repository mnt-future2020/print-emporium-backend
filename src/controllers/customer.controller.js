import Order from "../models/order.model.js";
import User from "../models/User.js";

/**
 * Get all customers (users who have placed at least one order)
 */
export const getAllCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    // Aggregation pipeline to find customers
    const pipeline = [
      // Group by userId to get order stats
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$pricing.total" },
          lastOrderDate: { $max: "$createdAt" },
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: "user",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      // Unwind user details
      { $unwind: "$userDetails" }
    ];

    // Search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "userDetails.name": { $regex: search, $options: "i" } },
            { "userDetails.email": { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    // Sort by last order date
    pipeline.push({ $sort: { lastOrderDate: -1 } });

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // For total count we need a separate operation or facet
    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: parseInt(limit) }]
        }
      }
    ];

    const results = await Order.aggregate(facetPipeline);
    const customers = results[0].data;
    const total = results[0].metadata[0]?.total || 0;

    // Format response
    const formattedCustomers = customers.map(c => ({
      id: c._id,
      name: c.userDetails.name,
      email: c.userDetails.email,
      image: c.userDetails.image,
      orderCount: c.orderCount,
      totalSpent: c.totalSpent,
      lastOrderDate: c.lastOrderDate,
      role: c.userDetails.role,
      createdAt: c.userDetails.createdAt
    }));

    res.json({
      success: true,
      customers: formattedCustomers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message
    });
  }
};

/**
 * Get customer details and their orders
 */
export const getCustomerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select("-password").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const orders = await Order.find({ userId: id }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      customer: user,
      orders
    });
  } catch (error) {
    console.error("Get customer details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
      error: error.message
    });
  }
};
