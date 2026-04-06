import Order from "../models/order.model.js";
import GeneralSettings from "../models/GeneralSettings.js";
import { generateOrderSlipPDF, generateShippingLabelPDF } from "../utils/pdf-generator.js";
import { getUrlFromPublicId } from "../utils/cloudinary-helper.js";

// --- Helpers ---

const getCompanyDetails = async () => {
  try {
    const settings = await GeneralSettings.findOne({ settingsId: "global" });
    if (!settings) {
      return {
        name: "Print Emporium",
        address:
          "123 Print Street, Creative District, Mumbai, Maharashtra 400001",
        phone: "+91 98765 43210",
        logoUrl: null,
        shippingLabelSizes: [],
      };
    }

    const logoUrl = settings.companyLogo
      ? getUrlFromPublicId(settings.companyLogo)
      : null;

    return {
      name: settings.companyName,
      address: settings.companyAddress, // This might be a long string, template handles multiline?
      phone: settings.companyPhone,
      logoUrl: logoUrl,
      shippingLabelSizes: settings.shippingLabelSizes || [],
    };
  } catch (error) {
    console.error("Error fetching company details:", error);
    return {
      name: "Print Emporium",
      address: "Address Unavailable",
      phone: "",
      logoUrl: null,
      shippingLabelSizes: [],
    };
  }
};

// --- Templates ---

const getOrderSlipTemplate = (order, company) => {
  const date = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const logoHtml = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="${company.name}" style="max-height: 150px; max-width: 250px; width: auto; object-fit: contain; display: block; margin: 0 auto;" />`
    : `<div class="logo" style="font-size: 20px; font-weight: bold; text-transform: uppercase; color: #000; text-align: center;">${company.name}</div>`;

  const itemsHtml = order.items
    .map(
      (item, index) => `
    <tr class="item-row">
      <td style="width: 5%; text-align: center;">${index + 1}</td>
      <td style="width: 25%;">
        <div class="item-name">${item.serviceName}</div>
        <div class="item-file">${item.fileName}</div>
      </td>
      <td style="width: 70%;">
        <table class="specs-table">
          <tr>
            <td class="spec-label">Paper Size:</td> <td class="spec-value">${item.configuration?.paperSize}</td>
            <td class="spec-label">Paper Type:</td> <td class="spec-value">${item.configuration?.paperType}</td>
          </tr>
          <tr>
            <td class="spec-label">Quality (GSM):</td> <td class="spec-value">${item.configuration?.gsm}</td>
            <td class="spec-label">Print Side:</td> <td class="spec-value">${item.configuration?.printSide}</td>
          </tr>
          <tr>
            <td class="spec-label">Color:</td> <td class="spec-value">${item.configuration?.printType?.toLowerCase().includes("color") ? "Color" : "B/W"}</td>
            <td class="spec-label">Binding:</td> <td class="spec-value">${item.configuration?.bindingOption || "None"}</td>
          </tr>
          <tr>
             <td class="spec-label">Copies:</td> <td class="spec-value"><strong>${item.configuration?.copies}</strong></td>
             <td class="spec-label">Pages:</td> <td class="spec-value">${item.pageCount || "-"}</td>
          </tr>
        </table>
      </td>
    </tr>
  `,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', sans-serif; padding: 30px; color: #000; line-height: 1.3; font-size: 14px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #000; padding: 15px 0; gap: 30px; }
        .logo-container { flex: 0 1 200px; text-align: center; display: flex; align-items: center; justify-content: center; }
        .logo { font-size: 24px; font-weight: bold; text-transform: uppercase; }
        .order-title { font-size: 24px; font-weight: bold; text-transform: uppercase; text-align: center; flex: 1; letter-spacing: 2px; }
        .order-meta { text-align: right; font-size: 12px; flex: 0 1 150px; }
        
        .section { margin-bottom: 20px; border: 1px solid #000; padding: 10px; }
        .section-header { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; font-size: 12px; }
        
        .cust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .row { display: flex; margin-bottom: 5px; }
        .label { width: 120px; font-weight: bold; }
        .val { flex: 1; }

        /* Items Table */
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th { text-align: left; border-bottom: 2px solid #000; padding: 5px; font-size: 11px; text-transform: uppercase; }
        .items-table td { border-bottom: 1px solid #ccc; padding: 8px 5px; vertical-align: top; }
        
        /* Specs Sub-table */
        .specs-table { width: 100%; font-size: 12px; }
        .specs-table td { border: none !important; padding: 2px 0 !important; }
        .spec-label { color: #555; width: 90px; }
        .spec-value { font-weight: bold; }

        .checkbox-group { display: flex; gap: 20px; margin-top: 10px; }
        .checkbox-item { display: flex; align-items: center; gap: 5px; font-weight: bold; text-transform: uppercase; font-size: 11px; }
        .square { width: 12px; height: 12px; border: 1px solid #000; display: inline-block; }

        .verification-box { margin-top: 20px; display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 20px; }
        .ver-item { width: 30%; }
        .line { border-bottom: 1px dashed #000; height: 20px; margin-top: 5px; }
        
        .item-name { font-weight: bold; font-size: 14px; }
        .item-file { font-size: 11px; color: #555; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-container">${logoHtml}</div>
        <div class="order-title">Job Sheet</div>
        <div class="order-meta" style="flex: 0 0 auto;">
          <div style="font-size: 16px; font-weight: bold;">#${order.orderNumber}</div>
          <div>${date}</div>
        </div>
      </div>

      <div class="section">
        <div class="cust-grid">
          <div>
            <div class="row"><span class="label">Customer Name:</span> <span class="val">${order.deliveryInfo.fullName}</span></div>
            <div class="row"><span class="label">Customer ID / Email:</span> <span class="val">${order.deliveryInfo.email}</span></div>
          </div>
          <div>
             <div class="row"><span class="label">Order Status:</span> <span class="val">${order.status}</span></div>
             <div class="row"><span class="label">Confirmed On:</span> <span class="val">${date}</span></div>
          </div>
        </div>
        
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;">
          <div class="section-header">Current Status (Tick Box)</div>
          <div class="checkbox-group">
            <div class="checkbox-item"><span class="square"></span> Processing</div>
            <div class="checkbox-item"><span class="square"></span> Printing</div>
            <div class="checkbox-item"><span class="square"></span> Binding</div>
            <div class="checkbox-item"><span class="square"></span> Quality Check</div>
            <div class="checkbox-item"><span class="square"></span> Shipped</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">Print Details</div>
        <table class="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Service / File</th>
              <th>Specifications</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div class="verification-box">
        <div class="ver-item">
          <div>Completed On:</div>
          <div class="line"></div>
        </div>
        <div class="ver-item">
          <div>Completed By:</div>
          <div class="line"></div>
        </div>
        <div class="ver-item">
          <div>Quality Verified By:</div>
          <div class="line"></div>
        </div>
      </div>

    </body>
    </html>
  `;
};

const getShippingLabelTemplate = (order, awb, courier, company) => {
  // Format company address for small label
  // Assuming it might be long, we might truncate or specific formatting
  const shortAddress =
    company.address.length > 60
      ? company.address.substring(0, 60) + "..."
      : company.address;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
        .container { 
          width: 100%; 
          height: 100%; 
          padding: 3mm; 
          box-sizing: border-box; 
          border: 1px dashed #ccc; 
          display: flex; 
          flex-direction: column;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 2px solid #000; 
          padding-bottom: 5px; 
          margin-bottom: 10px;
        }
        .courier { font-size: 16px; font-weight: bold; text-transform: uppercase; }
        .weight { font-size: 12px; font-weight: bold; border: 1px solid #000; padding: 2px 5px; }
        
        .address-box { margin-bottom: 15px; }
        .label { font-size: 8px; text-transform: uppercase; color: #555; margin-bottom: 2px; }
        .name { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
        .text { font-size: 12px; line-height: 1.3; }
        
        .barcode-section { 
          text-align: center; 
          margin-top: auto; 
          padding-top: 10px;
          border-top: 2px solid #000;
        }
        .awb-text { font-size: 14px; font-weight: bold; margin-top: 5px; letter-spacing: 1px; }
        
        .meta { 
          display: flex; 
          justify-content: space-between; 
          font-size: 10px; 
          margin-top: 10px; 
          border-top: 1px solid #ccc;
          padding-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="courier">${courier || "Standard Shipping"}</div>
          <div class="weight">PREPAID</div>
        </div>

        <div class="address-box">
          <div class="label">Deliver To:</div>
          <div class="name">${order.deliveryInfo.fullName}</div>
          <div class="text">
            ${order.deliveryInfo.address}<br>
            ${order.deliveryInfo.city}, ${order.deliveryInfo.state}<br>
            <strong>PIN: ${order.deliveryInfo.pincode}</strong>
          </div>
          <div class="text" style="margin-top: 5px;">Phone: ${
            order.deliveryInfo.phone
          }</div>
        </div>

        <div class="address-box" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
          <div class="label">From:</div>
          <div class="text">
            <strong>${company.name}</strong><br>
            ${shortAddress}<br>
            Support: ${company.phone}
          </div>
        </div>

        <div class="barcode-section">
          <div class="awb-text">AWB: ${awb}</div>
        </div>
        
        <div class="meta">
          <div>Order #${order.orderNumber}</div>
          <div>${new Date().toLocaleDateString("en-IN")}</div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// --- Controller Methods ---

export const generateOrderSlip = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { size = "A4" } = req.query;

    const [order, company] = await Promise.all([
      Order.findById(orderId),
      getCompanyDetails(),
    ]);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const pdfBuffer = await generateOrderSlipPDF(order, company, {
      format: size,
      marginMM: 10,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=OrderSlip-${order.orderNumber}.pdf`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating order slip:", error);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};

export const generateShippingLabel = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { awb, courier, size = "4x6" } = req.body;

    if (!awb) {
      return res
        .status(400)
        .json({ success: false, message: "AWB is required" });
    }

    const [order, company] = await Promise.all([
      Order.findById(orderId),
      getCompanyDetails(),
    ]);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Dynamic Size Logic (convert to points: 1in = 72pt)
    let widthPt = 288; // 4in
    let heightPt = 432; // 6in

    const sizeConfig = company.shippingLabelSizes?.find((s) => s.name === size);

    if (sizeConfig) {
      // Parse "4in" format to points
      const parseInches = (val) => parseFloat(val) * 72;
      widthPt = parseInches(sizeConfig.width);
      heightPt = parseInches(sizeConfig.height);
    } else {
      if (size === "4x4") {
        heightPt = 288; // 4in
      } else if (size === "4x2") {
        heightPt = 144; // 2in
      }
    }

    const pdfBuffer = await generateShippingLabelPDF(order, awb, courier, company, {
      widthPt,
      heightPt,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Label-${awb}.pdf`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating shipping label:", error);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};
