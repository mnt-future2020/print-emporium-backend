import nodemailer from "nodemailer";
import { getEmailConfig } from "../config/sendmail.js";
import GeneralSettings from "../models/GeneralSettings.js";
import { getUrlFromPublicId } from "../utils/cloudinary-helper.js";

/**
 * Send order confirmation email with invoice attachment
 */
export const sendOrderConfirmationEmail = async (order, invoicePDFBuffer) => {
  try {
    // Get email configuration
    const emailConfig = await getEmailConfig();
    const transporter = nodemailer.createTransport(emailConfig);

    // Get company settings
    const settings = await GeneralSettings.findOne({ settingsId: "global" });
    const companyName = settings?.companyName || "The Print Emporium";
    const companyEmail = settings?.companyEmail || emailConfig.from;

    // Get company logo URL using centralized helper function
    const companyLogo = getUrlFromPublicId(settings?.companyLogo, {
      width: 180,
      height: 70,
      crop: "fit"
    });
    
    // Logo HTML with better fallback
    let logoHtml = '';
    if (companyLogo) {
      logoHtml = `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <img 
                src="${companyLogo}" 
                alt="${companyName}" 
                width="180"
                height="70"
                style="display: block; max-width: 180px; height: auto; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;"
              />
            </td>
          </tr>
        </table>
      `;
    } else {
      logoHtml = `
        <div style="color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 12px; text-align: center;">
          ${companyName}
        </div>
      `;
    }

    const emailHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Order Confirmation - ${companyName}</title>
        <!--[if mso]>
        <style type="text/css">
          body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f8f9fb;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fb; padding: 20px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" style="max-width: 640px; background: #ffffff; box-shadow: 0 2px 4px rgba(0, 33, 160, 0.08);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); padding: 48px 32px;">
                    ${logoHtml}
                    <div style="color: white; text-align: center;">
                      <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: -0.5px; line-height: 1.2;">Order Confirmed</h1>
                      <p style="font-size: 15px; opacity: 0.95; font-weight: 400; margin: 0;">Your print order is being prepared</p>
                    </div>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 32px;">
                    
                    <p style="font-size: 16px; font-weight: 500; margin: 0 0 16px 0; color: #1a1a1a;">
                      Dear ${order.deliveryInfo?.fullName || "Valued Customer"},
                    </p>
                    
                    <p style="font-size: 15px; color: #4a4a4a; margin: 0 0 32px 0; line-height: 1.7;">
                      Thank you for your order. Your print job has been successfully confirmed and payment received. We're now preparing your materials with our standard quality assurance process. You'll receive regular updates as your order progresses through production.
                    </p>
                    
                    <!-- Order Details Section -->
                    <div style="margin: 32px 0;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0021a0; letter-spacing: 0.8px; margin-bottom: 18px;">
                        Order Details
                      </div>
                      
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8f9fb 0%, #eef2ff 100%); border-left: 4px solid #0021a0; border-radius: 6px; margin-bottom: 20px;">
                        <tr>
                          <td style="padding: 22px;">
                            <div style="font-size: 22px; font-weight: 700; color: #0021a0; margin-bottom: 16px; letter-spacing: -0.3px;">
                              ${order.orderNumber}
                            </div>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                                  <span style="font-weight: 600; color: #666;">Order Date</span>
                                </td>
                                <td style="padding: 10px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                                  <span style="color: #1a1a1a; font-weight: 500;">${new Date(order.createdAt).toLocaleDateString("en-IN", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 10px 0; font-size: 14px; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                                  <span style="font-weight: 600; color: #666;">Payment Status</span>
                                </td>
                                <td style="padding: 10px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(0, 33, 160, 0.1);">
                                  <span style="background: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 16px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px;">Confirmed</span>
                                </td>
                              </tr>
                              ${order.deliveryInfo?.scheduleDelivery && order.estimatedDelivery ? `
                              <tr>
                                <td style="padding: 10px 0; font-size: 14px;">
                                  <span style="font-weight: 600; color: #666;">Scheduled Delivery</span>
                                </td>
                                <td style="padding: 10px 0; font-size: 14px; text-align: right;">
                                  <span style="color: #1a1a1a; font-weight: 500;">${new Date(order.estimatedDelivery).toLocaleDateString("en-IN", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}</span>
                                </td>
                              </tr>
                              ` : ''}
                            </table>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Total Section -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8f9fb 0%, #eef2ff 100%); border: 1px solid rgba(0, 33, 160, 0.1); border-radius: 6px; margin: 32px 0;">
                      <tr>
                        <td style="padding: 28px 24px; text-align: center;">
                          <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px; font-weight: 600;">
                            Order Total
                          </div>
                          <div style="font-size: 36px; font-weight: 700; color: #0021a0; letter-spacing: -0.5px;">
                            ₹${order.pricing.total.toFixed(2)}
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Order Items -->
                    <div style="margin: 32px 0;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0021a0; letter-spacing: 0.8px; margin-bottom: 18px;">
                        Order Items (${order.items.length})
                      </div>
                      
                      ${order.items.map((item, index) => `
                        <div style="padding: 16px 0; border-bottom: ${index === order.items.length - 1 ? 'none' : '1px solid #e8ecf1'};">
                          <div style="font-weight: 700; color: #1a1a1a; margin-bottom: 6px; font-size: 15px;">
                            ${item.serviceName}
                          </div>
                          <div style="font-size: 13px; color: #666; line-height: 1.6;">
                            ${item.fileName} (${item.pageCount} pages)<br/>
                            ${item.configuration.copies} ${item.configuration.copies > 1 ? "copies" : "copy"} • ${item.configuration.printType} • ${item.configuration.paperSize} • ${item.configuration.paperType}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                    
                    <!-- Delivery Address -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8f9fb 0%, #eef2ff 100%); border: 1px solid rgba(0, 33, 160, 0.1); border-radius: 6px; margin: 32px 0;">
                      <tr>
                        <td style="padding: 22px;">
                          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0021a0; letter-spacing: 0.8px; margin-bottom: 14px;">
                            Delivery Address
                          </div>
                          <div style="font-size: 14px; color: #1a1a1a; line-height: 1.8;">
                            ${order.deliveryInfo?.address}<br/>
                            ${order.deliveryInfo?.city}, ${order.deliveryInfo?.state} – ${order.deliveryInfo?.pincode}<br/>
                            <br/>
                            <strong>Contact:</strong> ${order.deliveryInfo?.phone}
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Next Steps -->
                    <div style="margin: 32px 0; font-size: 14px; color: #1a1a1a;">
                      <div style="color: #0021a0; font-weight: 700; margin-bottom: 14px; font-size: 14px;">
                        What Happens Next
                      </div>
                      <div style="margin: 0; padding: 0;">
                        <div style="padding: 8px 0 8px 24px; position: relative; color: #4a4a4a;">• Quality review and file verification</div>
                        <div style="padding: 8px 0 8px 24px; position: relative; color: #4a4a4a;">• Production scheduling and printing</div>
                        <div style="padding: 8px 0 8px 24px; position: relative; color: #4a4a4a;">• Final inspection and packaging</div>
                        <div style="padding: 8px 0 8px 24px; position: relative; color: #4a4a4a;">• Dispatch to your delivery address</div>
                      </div>
                    </div>
                    
                    <!-- CTA Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 28px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); border-radius: 6px; box-shadow: 0 4px 12px rgba(0, 33, 160, 0.15);">
                                <a href="${process.env.FRONTEND_URL}/dashboard/orders" target="_blank" style="display: inline-block; color: #ffffff; padding: 14px 32px; text-decoration: none; font-weight: 600; font-size: 14px; letter-spacing: 0.3px;">
                                  Track Your Order
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Support Info -->
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e8ecf1; font-size: 13px; color: #666; line-height: 1.8;">
                      <strong style="color: #1a1a1a; font-weight: 600;">Need assistance?</strong> Our support team is available to help.<br/>
                      <strong style="color: #1a1a1a; font-weight: 600;">Email:</strong> ${companyEmail}<br/>
                      ${settings?.companyPhone ? `<strong style="color: #1a1a1a; font-weight: 600;">Phone:</strong> ${settings.companyPhone}` : ''}
                    </div>
                    
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #f8f9fb; padding: 32px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e8ecf1;">
                    <p style="margin: 0 0 12px 0;">
                      ${settings?.footerNote || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
                    </p>
                    <p style="margin: 0;">
                      <a href="${process.env.FRONTEND_URL}" style="color: #0021a0; text-decoration: none; font-weight: 600;">Visit Our Website</a>
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

    // Send email with invoice attachment
    const mailOptions = {
      from: `"${companyName}" <${companyEmail}>`,
      to: order.deliveryInfo?.email,
      subject: `Order Confirmation – ${order.orderNumber}`,
      html: emailHTML,
      attachments: [
        {
          filename: `Invoice-${order.orderNumber}.pdf`,
          content: invoicePDFBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    throw error;
  }
};

/**
 * Send order status update email notification
 */
export const sendOrderStatusUpdateEmail = async (order) => {
  try {
    // Get email configuration
    const emailConfig = await getEmailConfig();
    const transporter = nodemailer.createTransport(emailConfig);

    // Get company settings
    const settings = await GeneralSettings.findOne({ settingsId: "global" });
    const companyName = settings?.companyName || "The Print Emporium";
    const companyEmail = settings?.companyEmail || emailConfig.from;
    const trackingWebsiteUrl = settings?.trackingWebsiteUrl || "https://www.delhivery.com/";

    // Get company logo URL
    const companyLogo = getUrlFromPublicId(settings?.companyLogo, {
      width: 180,
      height: 70,
      crop: "fit"
    });

    // Logo HTML
    let logoHtml = '';
    if (companyLogo) {
      logoHtml = `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <img 
                src="${companyLogo}" 
                alt="${companyName}" 
                width="180"
                height="70"
                style="display: block; max-width: 180px; height: auto; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;"
              />
            </td>
          </tr>
        </table>
      `;
    } else {
      logoHtml = `
        <div style="color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 12px; text-align: center;">
          ${companyName}
        </div>
      `;
    }

    // Status display name and message
    const statusMap = {
      'pending': { label: 'Pending', color: '#f59e0b', message: 'Your order is currently pending review.' },
      'confirmed': { label: 'Confirmed', color: '#10b981', message: 'Your order has been confirmed and will be processed soon.' },
      'processing': { label: 'Processing', color: '#3b82f6', message: 'Your order is now being processed.' },
      'printing': { label: 'Printing', color: '#8b5cf6', message: 'Your order is currently in the printing phase.' },
      'shipped': { label: 'Shipped', color: '#0ea5e9', message: 'Exciting news! Your order has been shipped.' },
      'delivered': { label: 'Delivered', color: '#059669', message: 'Your order has been delivered successfully. Thank you for choosing us!' },
      'cancelled': { label: 'Cancelled', color: '#ef4444', message: 'Your order has been cancelled.' }
    };

    const statusInfo = statusMap[order.status] || { label: order.status, color: '#6b7280', message: `Your order status has been updated to ${order.status}.` };

    // Tracking info HTML
    let trackingHtml = '';
    if (order.status === 'shipped' && (order.trackingNumber || trackingWebsiteUrl)) {
      trackingHtml = `
        <div style="margin: 32px 0; padding: 24px; background: #eef2ff; border-radius: 12px; border: 1px solid #c7d2fe;">
          <div style="font-size: 14px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">
            Tracking Information
          </div>
          ${order.trackingNumber ? `
            <div style="font-size: 16px; color: #1e1b4b; margin-bottom: 8px;">
              <strong>Tracking Number:</strong> <span style="font-family: monospace; background: #ffffff; padding: 2px 6px; border-radius: 4px;">${order.trackingNumber}</span>
            </div>
          ` : ''}
          ${trackingWebsiteUrl ? `
            <div style="margin-top: 16px;">
              <a href="${trackingWebsiteUrl}" target="_blank" style="display: inline-block; background: #4338ca; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                Track on Carrier Website
              </a>
            </div>
          ` : ''}
        </div>
      `;
    }

    const emailHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Update - ${order.orderNumber}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f8f9fb;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fb; padding: 20px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border-radius: 16px; overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); padding: 40px 32px; text-align: center;">
                    ${logoHtml}
                    <div style="color: white;">
                      <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">Order Status Update</h1>
                      <p style="font-size: 16px; opacity: 0.9; margin: 0;">Order #${order.orderNumber}</p>
                    </div>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 32px;">
                    <p style="font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">Hello ${order.deliveryInfo?.fullName || 'Customer'},</p>
                    
                    <p style="font-size: 15px; color: #4b5563; margin-bottom: 24px;">
                      We're writing to let you know that the status of your order <strong>${order.orderNumber}</strong> has been updated.
                    </p>

                    <div style="text-align: center; margin: 32px 0;">
                      <div style="display: inline-block; padding: 8px 20px; background: ${statusInfo.color}15; border: 1px solid ${statusInfo.color}; border-radius: 30px; color: ${statusInfo.color}; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                        ${statusInfo.label}
                      </div>
                      <p style="margin-top: 16px; color: #1f2937; font-size: 16px;">${statusInfo.message}</p>
                    </div>

                    ${trackingHtml}

                    <div style="margin-top: 32px; padding: 20px; background: #f9fafb; border-radius: 10px;">
                      <h3 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin: 0 0 12px 0; letter-spacing: 0.5px;">Order Summary</h3>
                      <table width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="font-size: 14px; color: #4b5563; padding: 4px 0;">Items:</td>
                          <td style="font-size: 14px; color: #111827; text-align: right; padding: 4px 0;">${order.items.length}</td>
                        </tr>
                        <tr>
                          <td style="font-size: 14px; color: #4b5563; padding: 4px 0;">Total Amount:</td>
                          <td style="font-size: 14px; color: #0021a0; text-align: right; padding: 4px 0; font-weight: 700;">₹${order.pricing.total.toFixed(2)}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="text-align: center; margin-top: 40px;">
                      <a href="${process.env.FRONTEND_URL}/dashboard/orders/${order._id}" style="display: inline-block; background: #0021a0; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                        View Order Details
                      </a>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #f8f9fb; padding: 32px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 8px 0;">
                      Questions? Contact us at <a href="mailto:${companyEmail}" style="color: #0021a0; text-decoration: none;">${companyEmail}</a>
                    </p>
                    <p style="margin: 0;">
                      © ${new Date().getFullYear()} ${companyName}. All rights reserved.
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

    const mailOptions = {
      from: `"${companyName}" <${companyEmail}>`,
      to: order.deliveryInfo?.email,
      subject: `Update on your order #${order.orderNumber} - ${statusInfo.label}`,
      html: emailHTML,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Don't throw error to avoid breaking the status update flow
    return { success: false, error: error.message };
  }
};