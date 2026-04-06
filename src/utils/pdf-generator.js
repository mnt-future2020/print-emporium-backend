import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Convert mm to PDF points (1mm = 2.835pt)
const mm = (val) => val * 2.835;

// Color helpers
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.33, 0.33, 0.33);
const LIGHT_GRAY = rgb(0.8, 0.8, 0.8);

/**
 * Generate PDF from structured order data using pdf-lib (no browser required).
 * This replaces the Puppeteer-based approach for production compatibility.
 */
export const generateOrderSlipPDF = async (order, company, options = {}) => {
  const format = options.format || "A4";
  const pageWidth = format === "A4" ? 595.28 : 612; // A4 or Letter
  const pageHeight = format === "A4" ? 841.89 : 792;
  const margin = mm(options.marginMM || 15);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  const contentWidth = pageWidth - margin * 2;
  let y = pageHeight - margin;

  // Helper functions
  // Sanitize text for WinAnsi encoding (standard PDF fonts can't handle ₹ and other non-Latin chars)
  const sanitize = (str) => String(str ?? "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/₹/g, "Rs.")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

  const drawText = (text, x, yPos, opts = {}) => {
    const size = opts.size || 10;
    const f = opts.bold ? fontBold : font;
    const color = opts.color || BLACK;
    page.drawText(sanitize(text), { x, y: yPos, size, font: f, color });
  };

  const drawLine = (x1, y1, x2, y2, thickness = 1) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: BLACK });
  };

  const drawDashedLine = (x1, y1, x2, y2) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: LIGHT_GRAY });
  };

  const drawRect = (x, yPos, w, h, opts = {}) => {
    page.drawRectangle({
      x, y: yPos, width: w, height: h,
      borderColor: opts.borderColor || BLACK,
      borderWidth: opts.borderWidth || 1,
      color: opts.fill || undefined,
    });
  };

  const checkPageSpace = (needed) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // ==================== HEADER ====================
  // Company name / logo text
  drawText(company.name || "Print Emporium", margin, y, { size: 16, bold: true });

  // Order title centered
  const titleText = "JOB SHEET";
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 18);
  drawText(titleText, (pageWidth - titleWidth) / 2, y, { size: 18, bold: true });

  // Order number right-aligned
  const orderNum = `#${order.orderNumber}`;
  const orderNumWidth = fontBold.widthOfTextAtSize(orderNum, 14);
  drawText(orderNum, pageWidth - margin - orderNumWidth, y, { size: 14, bold: true });

  y -= 16;

  // Date right-aligned
  const date = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const dateWidth = font.widthOfTextAtSize(date, 9);
  drawText(date, pageWidth - margin - dateWidth, y, { size: 9, color: GRAY });

  y -= 10;
  drawLine(margin, y, pageWidth - margin, y, 2);
  y -= 20;

  // ==================== CUSTOMER INFO ====================
  drawRect(margin, y - 80, contentWidth, 80);

  const col1X = margin + 10;
  const col2X = margin + contentWidth / 2 + 10;
  let infoY = y - 15;

  drawText("Customer Name:", col1X, infoY, { size: 9, bold: true });
  drawText(order.deliveryInfo?.fullName || "", col1X + 100, infoY, { size: 9 });
  drawText("Order Status:", col2X, infoY, { size: 9, bold: true });
  drawText(order.status?.toUpperCase() || "", col2X + 85, infoY, { size: 9, bold: true });

  infoY -= 16;
  drawText("Email:", col1X, infoY, { size: 9, bold: true });
  drawText(order.deliveryInfo?.email || "", col1X + 100, infoY, { size: 9 });
  drawText("Date:", col2X, infoY, { size: 9, bold: true });
  drawText(date, col2X + 85, infoY, { size: 9 });

  infoY -= 16;
  drawText("Phone:", col1X, infoY, { size: 9, bold: true });
  drawText(order.deliveryInfo?.phone || "", col1X + 100, infoY, { size: 9 });

  // Status checkboxes
  infoY -= 22;
  drawDashedLine(margin + 10, infoY + 10, margin + contentWidth - 10, infoY + 10);
  drawText("STATUS:", col1X, infoY, { size: 8, bold: true, color: GRAY });

  const statuses = ["Processing", "Printing", "Binding", "Quality Check", "Shipped"];
  let checkX = col1X + 55;
  for (const status of statuses) {
    drawRect(checkX, infoY - 1, 9, 9, { borderWidth: 0.75 });
    drawText(status, checkX + 13, infoY, { size: 8, bold: true });
    checkX += font.widthOfTextAtSize(status, 8) + 28;
  }

  y -= 100;

  // ==================== PRINT DETAILS ====================
  y -= 10;
  drawText("PRINT DETAILS", margin, y, { size: 11, bold: true });
  y -= 5;
  drawLine(margin, y, pageWidth - margin, y, 1.5);
  y -= 5;

  // Table header
  const colNo = margin;
  const colService = margin + 30;
  const colSpecs = margin + 170;
  const headerY = y - 12;

  drawText("#", colNo + 5, headerY, { size: 8, bold: true, color: GRAY });
  drawText("SERVICE / FILE", colService, headerY, { size: 8, bold: true, color: GRAY });
  drawText("SPECIFICATIONS", colSpecs, headerY, { size: 8, bold: true, color: GRAY });

  y = headerY - 8;
  drawLine(margin, y, pageWidth - margin, y, 1);
  y -= 5;

  // Items
  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    const config = item.configuration || {};
    const rowHeight = 80;

    checkPageSpace(rowHeight + 10);

    const rowY = y;

    // Item number
    drawText(String(i + 1), colNo + 8, rowY - 14, { size: 9 });

    // Service name and file
    drawText(item.serviceName || "", colService, rowY - 14, { size: 10, bold: true });
    const fileName = item.fileName || "";
    const truncatedName = fileName.length > 30 ? fileName.substring(0, 30) + "..." : fileName;
    drawText(truncatedName, colService, rowY - 26, { size: 8, color: GRAY });

    // Specifications grid
    const specX1 = colSpecs;
    const specX2 = colSpecs + 150;
    const labelOffset = 80;
    let specY = rowY - 14;

    const specs = [
      ["Paper Size:", config.paperSize, "Paper Type:", config.paperType],
      ["Quality (GSM):", config.gsm, "Print Side:", config.printSide],
      ["Color:", config.printType?.toLowerCase?.().includes("color") ? "Color" : "B/W", "Binding:", config.bindingOption || "None"],
      ["Copies:", String(config.copies || 1), "Pages:", String(item.pageCount || "-")],
    ];

    for (const [label1, val1, label2, val2] of specs) {
      drawText(label1, specX1, specY, { size: 8, color: GRAY });
      drawText(String(val1 || "-"), specX1 + labelOffset, specY, { size: 8, bold: true });
      drawText(label2, specX2, specY, { size: 8, color: GRAY });
      drawText(String(val2 || "-"), specX2 + labelOffset, specY, { size: 8, bold: true });
      specY -= 13;
    }

    y -= rowHeight;
    drawDashedLine(margin, y, pageWidth - margin, y);
    y -= 5;
  }

  // ==================== VERIFICATION SECTION ====================
  y -= 15;
  checkPageSpace(60);
  drawLine(margin, y, pageWidth - margin, y, 0.75);
  y -= 25;

  const verItems = ["Completed On:", "Completed By:", "Quality Verified By:"];
  const verSpacing = contentWidth / 3;

  for (let i = 0; i < verItems.length; i++) {
    const vx = margin + i * verSpacing;
    drawText(verItems[i], vx, y, { size: 9 });
    drawDashedLine(vx, y - 15, vx + verSpacing - 20, y - 15);
  }

  return Buffer.from(await pdfDoc.save());
};

/**
 * Generate shipping label PDF using pdf-lib
 */
export const generateShippingLabelPDF = async (order, awb, courier, company, options = {}) => {
  const width = options.widthPt || 288; // 4 inches
  const height = options.heightPt || 432; // 6 inches
  const pad = 10;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([width, height]);
  let y = height - pad;

  const sanitize = (str) => String(str ?? "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/₹/g, "Rs.")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

  const drawText = (text, x, yPos, opts = {}) => {
    const size = opts.size || 10;
    const f = opts.bold ? fontBold : font;
    page.drawText(sanitize(text), { x, y: yPos, size, font: f, color: opts.color || BLACK });
  };

  const drawLine = (x1, y1, x2, y2, thickness = 1) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: BLACK });
  };

  // Header
  drawText(courier || "Standard Shipping", pad, y - 14, { size: 14, bold: true });
  drawText("PREPAID", width - pad - 50, y - 14, { size: 10, bold: true });
  y -= 25;
  drawLine(pad, y, width - pad, y, 2);
  y -= 20;

  // Deliver To
  drawText("DELIVER TO:", pad, y, { size: 7, color: GRAY });
  y -= 14;
  drawText(order.deliveryInfo?.fullName || "", pad, y, { size: 12, bold: true });
  y -= 14;
  drawText(order.deliveryInfo?.address || "", pad, y, { size: 9 });
  y -= 12;
  drawText(`${order.deliveryInfo?.city || ""}, ${order.deliveryInfo?.state || ""}`, pad, y, { size: 9 });
  y -= 12;
  drawText(`PIN: ${order.deliveryInfo?.pincode || ""}`, pad, y, { size: 9, bold: true });
  y -= 14;
  drawText(`Phone: ${order.deliveryInfo?.phone || ""}`, pad, y, { size: 9 });

  y -= 25;
  drawLine(pad, y, width - pad, y, 0.5);
  y -= 15;

  // From
  drawText("FROM:", pad, y, { size: 7, color: GRAY });
  y -= 14;
  drawText(company.name || "", pad, y, { size: 10, bold: true });
  y -= 12;
  const shortAddr = (company.address || "").length > 60
    ? company.address.substring(0, 60) + "..."
    : company.address || "";
  drawText(shortAddr, pad, y, { size: 8 });
  y -= 12;
  drawText(`Support: ${company.phone || ""}`, pad, y, { size: 8 });

  // AWB section at bottom
  y -= 30;
  drawLine(pad, y, width - pad, y, 2);
  y -= 20;
  const awbText = `AWB: ${awb}`;
  const awbWidth = fontBold.widthOfTextAtSize(awbText, 12);
  drawText(awbText, (width - awbWidth) / 2, y, { size: 12, bold: true });

  y -= 20;
  drawLine(pad, y, width - pad, y, 0.5);
  y -= 12;
  drawText(`Order #${order.orderNumber}`, pad, y, { size: 8 });
  const dateStr = new Date().toLocaleDateString("en-IN");
  const dateWidth = font.widthOfTextAtSize(dateStr, 8);
  drawText(dateStr, width - pad - dateWidth, y, { size: 8 });

  return Buffer.from(await pdfDoc.save());
};


