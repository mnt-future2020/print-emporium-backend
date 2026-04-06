import Lead from "../models/Lead.js";

/**
 * Create a new lead from contact form
 */
export const createLead = async (req, res) => {
  try {
    const { name, email, phone, subject, message, source } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide all required fields (name, email, subject, message)" 
      });
    }

    const newLead = new Lead({
      name,
      email,
      phone,
      subject,
      message,
      source: source || "contact_form",
    });

    await newLead.save();

    res.status(201).json({
      success: true,
      message: "Your message has been received. We'll get back to you soon!",
      leadId: newLead._id,
    });
  } catch (error) {
    console.error("Create lead error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to process your request. Please try again later.",
      details: error.message 
    });
  }
};

/**
 * Get all leads (admin)
 */
export const getAllLeads = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Lead.countDocuments(query);

    res.json({
      success: true,
      leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all leads error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch leads",
      details: error.message 
    });
  }
};

/**
 * Update lead status or notes (admin)
 */
export const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, assignedTo } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    if (status) lead.status = status;
    if (notes !== undefined) lead.notes = notes;
    if (assignedTo !== undefined) lead.assignedTo = assignedTo;

    await lead.save();

    res.json({
      success: true,
      message: "Lead updated successfully",
      lead,
    });
  } catch (error) {
    console.error("Update lead error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update lead",
      details: error.message 
    });
  }
};

/**
 * Delete a lead (admin)
 */
export const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await Lead.findByIdAndDelete(id);
    
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Delete lead error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete lead",
      details: error.message 
    });
  }
};
