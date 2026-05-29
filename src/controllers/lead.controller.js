import Lead from "../models/Lead.js";
import { sendEmail } from "../config/sendmail.js";
import GeneralSettings from "../models/GeneralSettings.js";

/**
 * Create a new lead from contact form
 */
export const createLead = async (req, res) => {
  try {
    const { name, email, phone, companyName, subject, message, source } =
      req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields (name, email, subject, message)",
      });
    }

    const newLead = new Lead({
      name,
      email,
      phone,
      companyName,
      subject,
      message,
      source: source || "contact_form",
    });

    await newLead.save();

    // Send email notification to admin (non-blocking)
    sendAdminNotificationEmail(newLead).catch((error) => {
      console.error("Failed to send admin notification email:", error);
      // Don't throw error - email failure should not block lead creation
    });

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
      details: error.message,
    });
  }
};

/**
 * Send email notification to admin about new lead
 */
async function sendAdminNotificationEmail(lead) {
  try {
    // Get company settings for admin email
    const settings = await GeneralSettings.findOne({ settingsId: "global" });
    const companyName = settings?.companyName || "The Print Emporium";
    const adminEmail =
      settings?.companyEmail ||
      process.env.ADMIN_EMAIL ||
      process.env.SMTP_FROM_EMAIL;

    if (!adminEmail) {
      console.warn("No admin email configured for lead notifications");
      return;
    }

    const emailSubject = `🔔 New Contact Form Submission - ${lead.subject}`;

    const emailHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Lead Notification</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f8f9fb;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fb; padding: 20px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border-radius: 16px; overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); padding: 40px 32px; text-align: center;">
                    <div style="color: white;">
                      <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -0.5px;">🔔 New Contact Form Submission</h1>
                      <p style="font-size: 16px; opacity: 0.9; margin: 0;">A potential customer has reached out</p>
                    </div>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 32px;">
                    
                    <div style="background: linear-gradient(135deg, #f8f9fb 0%, #eef2ff 100%); border-left: 4px solid #0021a0; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0021a0; letter-spacing: 0.8px; margin-bottom: 16px;">
                        Lead Information
                      </div>
                      
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <span style="font-weight: 600; color: #666;">Full Name</span>
                          </td>
                          <td style="padding: 10px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <span style="color: #1a1a1a; font-weight: 600;">${lead.name}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <span style="font-weight: 600; color: #666;">Email Address</span>
                          </td>
                          <td style="padding: 10px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <a href="mailto:${lead.email}" style="color: #0021a0; text-decoration: none; font-weight: 500;">${lead.email}</a>
                          </td>
                        </tr>
                        ${
                          lead.phone
                            ? `
                        <tr>
                          <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <span style="font-weight: 600; color: #666;">Phone Number</span>
                          </td>
                          <td style="padding: 10px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <a href="tel:${lead.phone}" style="color: #0021a0; text-decoration: none; font-weight: 500;">${lead.phone}</a>
                          </td>
                        </tr>
                        `
                            : ""
                        }
                        ${
                          lead.companyName
                            ? `
                        <tr>
                          <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <span style="font-weight: 600; color: #666;">Company Name</span>
                          </td>
                          <td style="padding: 10px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <span style="color: #1a1a1a; font-weight: 500;">${lead.companyName}</span>
                          </td>
                        </tr>
                        `
                            : ""
                        }
                        <tr>
                          <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <span style="font-weight: 600; color: #666;">Source</span>
                          </td>
                          <td style="padding: 10px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                            <span style="color: #1a1a1a; font-weight: 500; text-transform: capitalize;">${lead.source.replace("_", " ")}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">Submission Time</span>
                          </td>
                          <td style="padding: 10px 0; font-size: 14px; text-align: right;">
                            <span style="color: #1a1a1a; font-weight: 500;">${new Date(
                              lead.createdAt,
                            ).toLocaleString("en-IN", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}</span>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <!-- Subject -->
                    <div style="margin-bottom: 24px;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0021a0; letter-spacing: 0.8px; margin-bottom: 12px;">
                        Subject
                      </div>
                      <div style="background: #f8f9fb; border: 1px solid #e8ecf1; border-radius: 8px; padding: 16px; font-size: 16px; font-weight: 600; color: #1a1a1a;">
                        ${lead.subject}
                      </div>
                    </div>

                    <!-- Message -->
                    <div style="margin-bottom: 32px;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0021a0; letter-spacing: 0.8px; margin-bottom: 12px;">
                        Message
                      </div>
                      <div style="background: #f8f9fb; border: 1px solid #e8ecf1; border-radius: 8px; padding: 20px; font-size: 15px; line-height: 1.8; color: #4a4a4a; white-space: pre-wrap;">
${lead.message}
                      </div>
                    </div>

                    <!-- CTA Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 28px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 33, 160, 0.15);">
                                <a href="${process.env.FRONTEND_URL || process.env.BETTER_AUTH_URL?.replace("/api/auth", "")}/dashboard?tab=leads" target="_blank" style="display: inline-block; color: #ffffff; padding: 14px 32px; text-decoration: none; font-weight: 600; font-size: 14px; letter-spacing: 0.3px;">
                                  View in Dashboard
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Quick Actions -->
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e8ecf1;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #666; letter-spacing: 0.8px; margin-bottom: 16px;">
                        Quick Actions
                      </div>
                      <div style="display: flex; gap: 12px;">
                        <a href="mailto:${lead.email}" style="display: inline-block; background: #f8f9fb; color: #0021a0; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; border: 1px solid #e8ecf1;">
                          📧 Reply via Email
                        </a>
                        ${
                          lead.phone
                            ? `
                        <a href="tel:${lead.phone}" style="display: inline-block; background: #f8f9fb; color: #0021a0; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; border: 1px solid #e8ecf1;">
                          📞 Call Now
                        </a>
                        `
                            : ""
                        }
                      </div>
                    </div>
                    
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #f8f9fb; padding: 24px 32px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e8ecf1;">
                    <p style="margin: 0;">
                      This is an automated notification from ${companyName} Contact Form
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await sendEmail(adminEmail, emailSubject, emailHTML);
  } catch (error) {
    console.error("Error sending admin notification email:", error);
    throw error;
  }
}

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
    res.status(500).json({
      success: false,
      message: "Failed to fetch leads",
      details: error.message,
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
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
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
    res.status(500).json({
      success: false,
      message: "Failed to update lead",
      details: error.message,
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
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete lead",
      details: error.message,
    });
  }
};
