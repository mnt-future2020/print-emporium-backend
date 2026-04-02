import GeneralSettings from "../models/GeneralSettings.js";
import { getUrlFromPublicId } from "../utils/cloudinary-helper.js";

/**
 * Generate professional invoice HTML for paid orders
 * Updated with professional deep blue color scheme (#0021a0) and polished styling
 */
export const generateInvoiceHTML = async (order) => {
  // Fetch company settings
  let settings = await GeneralSettings.findOne({ settingsId: "global" });

  if (!settings) {
    // Use default settings if not found
    settings = {
      companyName: "The Print Emporium",
      companyEmail: "info@printemporium.com",
      companyPhone: "+91 431 2345678",
      companyAddress:
        "No. 45, Main Road, Thillai Nagar, Trichy – 620018, Tamil Nadu, India",
      gstNumber: "33ABCDE1234F1Z5",
      termsAndConditions:
        "All orders are subject to verification. Prices are inclusive of GST.",
      footerNote: "© 2026 The Print Emporium. All rights reserved.",
    };
  }

  const companyLogo = settings.companyLogo
    ? getUrlFromPublicId(settings.companyLogo)
    : null;

  const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice - ${order.orderNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          size: A4;
          margin: 15mm;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          padding: 0;
          background: white;
          color: #1a1a1a;
          line-height: 1.6;
        }

        .invoice-container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          padding: 30px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 20px;
          border-bottom: 3px solid #0021a0;
          margin-bottom: 30px;
        }

        .company-info h1 {
          font-size: 22px;
          font-weight: 700;
          color: #0021a0;
          margin-bottom: 8px;
          line-height: 1.2;
          letter-spacing: -0.3px;
        }

        .company-info p {
          font-size: 12px;
          line-height: 1.7;
          color: #666;
        }

        .company-logo {
          max-width: 200px;
          max-height: 200px;
          margin-bottom: 12px;
          display: block;
        }

        .invoice-info {
          text-align: right;
          max-width: 45%;
        }

        .invoice-info h2 {
          font-size: 32px;
          font-weight: 700;
          color: #0021a0;
          margin-bottom: 12px;
          line-height: 1;
          letter-spacing: -0.5px;
        }

        .invoice-info p {
          font-size: 12px;
          color: #666;
          line-height: 1.8;
        }

        .info-row {
          margin-bottom: 6px;
        }

        .info-label {
          color: #1a1a1a;
          font-weight: 600;
          display: inline-block;
          min-width: 100px;
        }

        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 14px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-left: 8px;
        }

        .badge-paid {
          background: #e8f5e9;
          color: #2e7d32;
          border: 1px solid #c8e6c9;
        }

        .badge-scheduled {
          background: #ede9fe;
          color: #5b21b6;
          border: 1px solid #ddd6fe;
        }

        .info-grid {
          display: flex;
          gap: 24px;
          margin-bottom: 30px;
        }

        .info-box {
          flex: 1;
          padding: 18px;
          background: linear-gradient(135deg, #f8f9fb 0%, #eef2ff 100%);
          border-radius: 8px;
          border: 1px solid rgba(0, 33, 160, 0.1);
        }

        .info-box h3 {
          font-size: 11px;
          color: #0021a0;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          font-weight: 700;
        }

        .info-box p {
          font-size: 12px;
          line-height: 1.7;
          color: #1a1a1a;
        }

        .info-box strong {
          font-weight: 600;
          color: #0021a0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          border: 1px solid #e8ecf1;
          border-radius: 8px;
          overflow: hidden;
        }

        thead {
          background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%);
          color: white;
        }

        th {
          padding: 12px 10px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        th:nth-child(2),
        th:nth-child(3) {
          text-align: center;
        }

        th:nth-child(4) {
          text-align: right;
          width: 25%;
        }

        td {
          padding: 12px 10px;
          font-size: 12px;
          border-bottom: 1px solid #e8ecf1;
        }

        td:first-child {
          width: 55%;
          vertical-align: top;
        }

        td:nth-child(2),
        td:nth-child(3) {
          text-align: center;
          width: 10%;
        }

        td:nth-child(4) {
          text-align: right;
          width: 25%;
        }

        .item-name {
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 4px;
          font-size: 12px;
        }

        .item-file {
          font-size: 11px;
          color: #666;
          margin-top: 3px;
        }

        .item-config {
          font-size: 11px;
          color: #888;
          margin-top: 3px;
          line-height: 1.5;
        }

        .pricing-breakdown {
          font-size: 11px;
          color: #666;
          margin-top: 6px;
          padding: 8px;
          background: #f8f9fb;
          border-radius: 4px;
          border-left: 3px solid #0021a0;
        }

        .pricing-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
          line-height: 1.5;
        }

        .pricing-total {
          display: flex;
          justify-content: space-between;
          padding-top: 4px;
          margin-top: 3px;
          border-top: 1px solid #e8ecf1;
          font-weight: 700;
          color: #0021a0;
        }

        .amount {
          font-weight: 700;
          font-size: 13px;
          color: #0021a0;
        }

        .calc {
          font-size: 10px;
          color: #666;
          margin-top: 2px;
        }

        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }

        .totals-box {
          width: 320px;
          background: linear-gradient(135deg, #f8f9fb 0%, #eef2ff 100%);
          padding: 18px;
          border-radius: 8px;
          border: 1px solid rgba(0, 33, 160, 0.1);
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          font-size: 13px;
          color: #1a1a1a;
          border-bottom: 1px solid #e8ecf1;
          padding-bottom: 12px;
        }

        .total-row.subtotal {
          font-weight: 600;
        }

        .total-row span:last-child {
          font-weight: 700;
        }

        .total-row.line-item {
          border-bottom: none;
          font-weight: 600;
        }

        .total-row.final-total {
          border-top: 2px solid #0021a0;
          padding-top: 14px;
          margin-top: 10px;
          font-size: 18px;
          font-weight: 700;
          color: #0021a0;
        }

        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e8ecf1;
        }

        .footer-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .footer-section h4 {
          font-size: 11px;
          color: #0021a0;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .footer-section p {
          font-size: 11px;
          color: #666;
          line-height: 1.6;
        }

        .footer-note {
          text-align: center;
          font-size: 10px;
          color: #888;
          padding-top: 15px;
          border-top: 1px solid #e8ecf1;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            ${
              companyLogo
                ? `<img src="${companyLogo}" alt="${settings.companyName}" class="company-logo"  />`
                : `<h1>${settings.companyName}</h1>`
            }
            <p>
              ${settings.companyAddress}<br>
              Phone: ${settings.companyPhone}<br>
              Email: ${settings.companyEmail}<br>
              ${settings.gstNumber ? `GST: ${settings.gstNumber}` : ""}
            </p>
          </div>
          <div class="invoice-info">
            <h2>INVOICE</h2>
            <p>
              <div class="info-row">
                <span class="info-label">Invoice No:</span> ${order.orderNumber}
              </div>
              <div class="info-row">
                <span class="info-label">Date:</span> ${new Date(
                  order.createdAt,
                ).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div class="info-row">
                <span class="info-label">Payment:</span>
                <span class="badge badge-paid">PAID</span>
              </div>
              ${
                order.deliveryInfo?.scheduleDelivery && order.estimatedDelivery
                  ? `<div class="info-row">
                      <span class="info-label">Scheduled:</span>
                      <span class="badge badge-scheduled">${new Date(
                        order.estimatedDelivery,
                      ).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}</span>
                    </div>`
                  : ""
              }
            </p>
          </div>
        </div>

        <!-- Customer & Delivery Info -->
        <div class="info-grid">
          <div class="info-box">
            <h3>Bill To</h3>
            <p>
              <strong>${order.deliveryInfo?.fullName || "N/A"}</strong><br>
              ${order.deliveryInfo?.email || ""}<br>
              ${order.deliveryInfo?.phone || ""}
            </p>
          </div>
          <div class="info-box">
            <h3>Deliver To</h3>
            <p>
              ${order.deliveryInfo?.address || ""}<br>
              ${order.deliveryInfo?.city || ""}, ${
                order.deliveryInfo?.state || ""
              }<br>
              ${order.deliveryInfo?.pincode || ""}
            </p>
          </div>
        </div>

        <!-- Items Table -->
        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th>Pages</th>
              <th>Copies</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${order.items
              .map(
                (item) => `
              <tr>
                <td>
                  <div class="item-name">${item.serviceName}</div>
                  <div class="item-file">${item.fileName} (${
                    item.pageCount
                  } pages)</div>
                  <div class="item-config">
                    ${item.configuration.printType} • ${
                      item.configuration.paperSize
                    } • ${item.configuration.paperType} • ${
                      item.configuration.gsm
                    }GSM • ${item.configuration.printSide}${
                      item.configuration.bindingOption &&
                      item.configuration.bindingOption !== "none"
                        ? ` • ${item.configuration.bindingOption}`
                        : ""
                    }
                  </div>
                  <div class="pricing-breakdown">
                    <div class="pricing-row">
                      <span>Base Price:</span>
                      <span>₹${item.pricing.basePricePerPage.toFixed(
                        2,
                      )}/page</span>
                    </div>
                    ${
                      item.pricing.printTypePrice > 0
                        ? `<div class="pricing-row"><span>Print Type:</span><span>+₹${item.pricing.printTypePrice.toFixed(
                            2,
                          )}/${
                            item.pricing.printTypeIsPerCopy ? "copy" : "page"
                          }</span></div>`
                        : ""
                    }
                    ${
                      item.pricing.paperSizePrice > 0
                        ? `<div class="pricing-row"><span>Paper Size:</span><span>+₹${item.pricing.paperSizePrice.toFixed(
                            2,
                          )}/${
                            item.pricing.paperSizeIsPerCopy ? "copy" : "page"
                          }</span></div>`
                        : ""
                    }
                    ${
                      item.pricing.paperTypePrice > 0
                        ? `<div class="pricing-row"><span>Paper Type:</span><span>+₹${item.pricing.paperTypePrice.toFixed(
                            2,
                          )}/${
                            item.pricing.paperTypeIsPerCopy ? "copy" : "page"
                          }</span></div>`
                        : ""
                    }
                    ${
                      item.pricing.gsmPrice > 0
                        ? `<div class="pricing-row"><span>GSM:</span><span>+₹${item.pricing.gsmPrice.toFixed(
                            2,
                          )}/${
                            item.pricing.gsmIsPerCopy ? "copy" : "page"
                          }</span></div>`
                        : ""
                    }
                    ${
                      item.pricing.printSidePrice > 0
                        ? `<div class="pricing-row"><span>Print Side:</span><span>+₹${item.pricing.printSidePrice.toFixed(
                            2,
                          )}/${
                            item.pricing.printSideIsPerCopy ? "copy" : "page"
                          }</span></div>`
                        : ""
                    }
                    ${
                      item.pricing.bindingPrice > 0
                        ? `<div class="pricing-row"><span>Binding:</span><span>+₹${item.pricing.bindingPrice.toFixed(
                            2,
                          )}/${
                            item.pricing.bindingIsPerCopy !== false
                              ? "copy"
                              : "page"
                          }</span></div>`
                        : ""
                    }
                    <div class="pricing-total">
                      <span>Total per Page:</span>
                      <span>₹${item.pricing.pricePerPage.toFixed(2)}</span>
                    </div>
                  </div>
                </td>
                <td>${item.pageCount}</td>
                <td>${item.configuration.copies}</td>
                <td>
                  <div class="amount">₹${item.pricing.subtotal.toFixed(2)}</div>
                  <div class="calc">
                    ${item.pageCount} × ${
                      item.configuration.copies
                    } × ₹${item.pricing.pricePerPage.toFixed(2)}
                  </div>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row subtotal">
              <span>Subtotal:</span>
              <span>₹${order.pricing.subtotal.toFixed(2)}</span>
            </div>
            ${
              order.pricing.deliveryCharge > 0
                ? `<div class="total-row line-item"><span>Delivery:</span><span>₹${order.pricing.deliveryCharge.toFixed(
                    2,
                  )}</span></div>`
                : ""
            }
            ${
              order.pricing.packingCharge > 0
                ? `<div class="total-row line-item"><span>Packing:</span><span>₹${order.pricing.packingCharge.toFixed(
                    2,
                  )}</span></div>`
                : ""
            }
            ${
              order.pricing.discount > 0
                ? `<div class="total-row line-item" style="color: #2e7d32; font-weight: 700;">
                    <span>Discount (${order.pricing.couponCode || "Coupon"}):</span>
                    <span>-₹${order.pricing.discount.toFixed(2)}</span>
                  </div>`
                : ""
            }
            <div class="total-row final-total">
              <span>Total Amount:</span>
              <span>₹${order.pricing.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-content">
            ${
              settings.termsAndConditions
                ? `<div class="footer-section">
                    <h4>Terms & Conditions</h4>
                    <p>${settings.termsAndConditions}</p>
                  </div>`
                : ""
            }
            <div class="footer-section">
              <h4>Need Help?</h4>
              <p>Contact us at ${settings.companyPhone} or email ${
                settings.companyEmail
              } for any queries or issues.</p>
            </div>
          </div>
          <div class="footer-note">
            ${
              settings.footerNote ||
              `© ${new Date().getFullYear()} ${
                settings.companyName
              }. All rights reserved.`
            }
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return invoiceHTML;
};
