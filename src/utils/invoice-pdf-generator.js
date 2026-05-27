import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import GeneralSettings from "../models/GeneralSettings.js";
import { getUrlFromPublicId } from "./cloudinary-helper.js";

// ─── Brand Colors (matching #0021a0 deep blue theme) ───
const PRIMARY = rgb(0, 0.129, 0.627);       // #0021a0
const BLACK = rgb(0.1, 0.1, 0.1);
const DARK = rgb(0.25, 0.25, 0.25);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_TEXT = rgb(0.53, 0.53, 0.53);
const GREEN = rgb(0.18, 0.49, 0.2);
const GREEN_BG = rgb(0.91, 0.96, 0.91);
const GREEN_BORDER = rgb(0.78, 0.9, 0.79);
const WHITE = rgb(1, 1, 1);
const BG_LIGHT = rgb(0.973, 0.976, 0.984);  // #f8f9fb
const BORDER = rgb(0.91, 0.93, 0.945);      // #e8ecf1
const PURPLE = rgb(0.357, 0.129, 0.714);
const PURPLE_BG = rgb(0.929, 0.914, 0.996);

// Standard PDF page sizes (in points; 72pt = 1 inch)
const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89, margin: 42.5 },     // 210 × 297 mm
  a5: { width: 419.53, height: 595.28, margin: 15 },       // 148 × 210 mm (reduced margin for compact layout)
};
const DEFAULT_SIZE = "a4";

// Size-specific scaling factors for A5 optimization
const SIZE_SCALE = {
  a4: {
    headerFont: 20,
    titleFont: 28,
    sectionFont: 11,
    bodyFont: 10,
    smallFont: 9,
    tinyFont: 8,
    microFont: 7,
    lineSpacing: 1.0,
    sectionSpacing: 1.0,
    logoMaxW: 200,
    logoMaxH: 120,
  },
  a5: {
    headerFont: 12,      // Reduced from 14
    titleFont: 18,       // Reduced from 20
    sectionFont: 8,      // Reduced from 9
    bodyFont: 7,         // Reduced from 8
    smallFont: 6.5,      // Reduced from 7
    tinyFont: 6,         // Reduced from 6.5
    microFont: 5,        // Reduced from 5.5
    lineSpacing: 0.65,   // Tighter from 0.75
    sectionSpacing: 0.5, // Tighter from 0.6
    logoMaxW: 100,       // Reduced from 120
    logoMaxH: 60,        // Reduced from 70
  },
};

// ─── Sanitize for WinAnsi encoding ───
const sanitize = (str) => String(str ?? "")
  .replace(/[\r\n\t]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/₹/g, "Rs.")
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

const fmt = (val) => `Rs.${(val || 0).toFixed(2)}`;

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", {
  year: "numeric", month: "long", day: "numeric",
});

/**
 * Generate a professional invoice PDF in the requested page size.
 * @param {object} order - Order document
 * @param {string} [size="a4"] - Page size: "a4" or "a5"
 */
export const generateInvoicePDF = async (order, size = DEFAULT_SIZE) => {
  const sizeKey = size?.toLowerCase() === "a5" ? "a5" : "a4";
  const { width: PAGE_WIDTH, height: PAGE_HEIGHT, margin: MARGIN } = PAGE_SIZES[sizeKey];
  const scale = SIZE_SCALE[sizeKey];

  let settings = await GeneralSettings.findOne({ settingsId: "global" });
  if (!settings) {
    settings = {
      companyName: "The Print Emporium",
      companyEmail: "info@printemporium.com",
      companyPhone: "+91 431 2345678",
      companyAddress: "No. 45, Main Road, Thillai Nagar, Trichy - 620018, Tamil Nadu, India",
      gstNumber: "33ABCDE1234F1Z5",
      termsAndConditions: "All orders are subject to verification. Prices are inclusive of GST.",
      footerNote: "",
    };
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const CW = PAGE_WIDTH - MARGIN * 2; // content width

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // ─── Drawing Helpers ───
  const draw = (str, x, yy, opts = {}) => {
    const s = opts.size || 10;
    const f = opts.bold ? fontBold : font;
    page.drawText(sanitize(str), { x, y: yy, size: s, font: f, color: opts.color || BLACK });
  };

  const drawRight = (str, yy, opts = {}) => {
    const s = opts.size || 10;
    const f = opts.bold ? fontBold : font;
    const w = f.widthOfTextAtSize(sanitize(str), s);
    draw(str, PAGE_WIDTH - MARGIN - w, yy, opts);
  };

  const hLine = (y1, opts = {}) => {
    page.drawLine({
      start: { x: MARGIN, y: y1 },
      end: { x: PAGE_WIDTH - MARGIN, y: y1 },
      thickness: opts.t || 1, color: opts.color || BORDER,
    });
  };

  const box = (x, yy, w, h, opts = {}) => {
    if (opts.fill) page.drawRectangle({ x, y: yy, width: w, height: h, color: opts.fill });
    if (opts.border) page.drawRectangle({ x, y: yy, width: w, height: h, borderColor: opts.border, borderWidth: opts.bw || 0.5 });
  };

  const badge = (str, x, yy, bgColor, textColor, borderColor) => {
    const s = sanitize(str);
    const badgeFont = sizeKey === "a5" ? scale.tinyFont : 8;
    const w = fontBold.widthOfTextAtSize(s, badgeFont) + (sizeKey === "a5" ? 12 : 16);
    const h = sizeKey === "a5" ? 12 : 15;
    box(x, yy - 4, w, h, { fill: bgColor, border: borderColor, bw: 0.75 });
    draw(str, x + (sizeKey === "a5" ? 6 : 8), yy, { size: badgeFont, bold: true, color: textColor });
    return w;
  };

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN + 20) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  // Word-wrap text to fit within maxWidth, returns array of lines
  const wrapText = (str, maxWidth, opts = {}) => {
    const s = opts.size || 10;
    const f = opts.bold ? fontBold : font;
    const text = sanitize(str);
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = f.widthOfTextAtSize(testLine, s);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // ════════════════════════════════════════════════
  //  HEADER - Company info (left) + Invoice info (right)
  // ════════════════════════════════════════════════

  // Try to embed company logo
  let logoEmbedded = false;
  const companyLogoUrl = settings.companyLogo ? getUrlFromPublicId(settings.companyLogo) : null;
  if (companyLogoUrl) {
    try {
      const response = await fetch(companyLogoUrl);
      if (response.ok) {
        const imageBytes = new Uint8Array(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "";
        let embeddedImage;
        if (contentType.includes("png")) {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        }
        const logoMaxW = scale.logoMaxW;
        const logoMaxH = scale.logoMaxH;
        const scaleRatio = Math.min(logoMaxW / embeddedImage.width, logoMaxH / embeddedImage.height, 1);
        const logoW = embeddedImage.width * scaleRatio;
        const logoH = embeddedImage.height * scaleRatio;
        page.drawImage(embeddedImage, { x: MARGIN, y: y - logoH + 8, width: logoW, height: logoH });
        y -= logoH + 4;
        logoEmbedded = true;
      }
    } catch (e) {
      // Logo fetch failed, fall back to text
    }
  }

  if (!logoEmbedded) {
    draw(settings.companyName, MARGIN, y, { size: scale.headerFont, bold: true, color: PRIMARY });
    y -= scale.headerFont * scale.lineSpacing;
  }

  const headerMaxW = CW * 0.55; // leave room for INVOICE title on right
  const addrHeaderLines = wrapText(settings.companyAddress || "", headerMaxW, { size: scale.tinyFont });
  for (const line of addrHeaderLines) {
    draw(line, MARGIN, y, { size: scale.tinyFont, color: GRAY });
    y -= scale.tinyFont * 1.4 * scale.lineSpacing;
  }
  draw(`Phone: ${settings.companyPhone || ""}`, MARGIN, y, { size: scale.tinyFont, color: GRAY });
  y -= scale.tinyFont * 1.4 * scale.lineSpacing;
  draw(`Email: ${settings.companyEmail || ""}`, MARGIN, y, { size: scale.tinyFont, color: GRAY });
  if (settings.gstNumber) {
    y -= scale.tinyFont * 1.4 * scale.lineSpacing;
    draw(`GST: ${settings.gstNumber}`, MARGIN, y, { size: scale.tinyFont, color: GRAY });
  }

  // Invoice title & meta (right side)
  const topY = PAGE_HEIGHT - MARGIN;
  drawRight("INVOICE", topY, { size: scale.titleFont, bold: true, color: PRIMARY });

  let metaY = topY - scale.titleFont * 1.3;
  drawRight(`Invoice No: ${order.orderNumber}`, metaY, { size: scale.bodyFont, color: GRAY });
  metaY -= scale.bodyFont * 1.5 * scale.lineSpacing;
  drawRight(`Date: ${fmtDate(order.createdAt)}`, metaY, { size: scale.bodyFont, color: GRAY });
  metaY -= scale.bodyFont * 1.5 * scale.lineSpacing;

  // "Payment:" label + PAID badge (right-aligned)
  const paidText = "PAID";
  const badgeFont = sizeKey === "a5" ? scale.tinyFont : 8;
  const paidW = fontBold.widthOfTextAtSize(paidText, badgeFont) + (sizeKey === "a5" ? 12 : 16);
  const payLabelW = fontBold.widthOfTextAtSize("Payment: ", scale.bodyFont);
  const paidX = PAGE_WIDTH - MARGIN - paidW;
  draw("Payment:", paidX - payLabelW - 4, metaY, { size: scale.bodyFont, bold: true, color: DARK });
  badge(paidText, paidX, metaY, GREEN_BG, GREEN, GREEN_BORDER);

  if (order.deliveryInfo?.scheduleDelivery && order.estimatedDelivery) {
    metaY -= 18 * scale.lineSpacing;
    const schedText = fmtDate(order.estimatedDelivery);
    const schedW = fontBold.widthOfTextAtSize(sanitize(schedText), badgeFont) + (sizeKey === "a5" ? 12 : 16);
    const schedLabelW = fontBold.widthOfTextAtSize("Scheduled: ", scale.bodyFont);
    const schedBadgeX = PAGE_WIDTH - MARGIN - schedW;
    draw("Scheduled:", schedBadgeX - schedLabelW - 4, metaY, { size: scale.bodyFont, bold: true, color: DARK });
    badge(schedText, schedBadgeX, metaY, PURPLE_BG, PURPLE, PURPLE_BG);
  }

  y -= 12 * scale.sectionSpacing;
  // Blue accent line under header
  hLine(y, { t: 3, color: PRIMARY });
  y -= 28 * scale.sectionSpacing;

  // ════════════════════════════════════════════════
  //  CUSTOMER INFO - Two boxes side by side
  // ════════════════════════════════════════════════
  const boxW = (CW - 18 * scale.sectionSpacing) / 2;
  const boxInnerW = boxW - 28 * scale.sectionSpacing; // padding left 14 + right 14

  // Pre-calculate Deliver To address lines to determine box height
  const fullAddress = [
    order.deliveryInfo?.address || "",
    `${order.deliveryInfo?.city || ""}, ${order.deliveryInfo?.state || ""}`,
    order.deliveryInfo?.pincode || "",
  ].filter(Boolean).join(", ");
  const addrLines = wrapText(fullAddress, boxInnerW, { size: scale.tinyFont });
  const boxH = Math.max(75 * scale.sectionSpacing, 32 * scale.sectionSpacing + addrLines.length * 13 * scale.lineSpacing + 10);

  // Bill To box
  box(MARGIN, y - boxH, boxW, boxH, { fill: BG_LIGHT });
  box(MARGIN, y - boxH, boxW, boxH, { border: BORDER, bw: 0.5 });
  page.drawRectangle({ x: MARGIN, y: y - boxH, width: 3, height: boxH, color: PRIMARY });

  draw("BILL TO", MARGIN + 14, y - 16 * scale.sectionSpacing, { size: scale.tinyFont, bold: true, color: PRIMARY });
  draw(order.deliveryInfo?.fullName || "N/A", MARGIN + 14, y - 32 * scale.sectionSpacing, { size: scale.sectionFont, bold: true, color: DARK });
  draw(order.deliveryInfo?.email || "", MARGIN + 14, y - 46 * scale.sectionSpacing, { size: scale.tinyFont, color: GRAY });
  draw(order.deliveryInfo?.phone || "", MARGIN + 14, y - 59 * scale.sectionSpacing, { size: scale.tinyFont, color: GRAY });

  // Deliver To box
  const b2x = MARGIN + boxW + 18 * scale.sectionSpacing;
  box(b2x, y - boxH, boxW, boxH, { fill: BG_LIGHT });
  box(b2x, y - boxH, boxW, boxH, { border: BORDER, bw: 0.5 });
  page.drawRectangle({ x: b2x, y: y - boxH, width: 3, height: boxH, color: PRIMARY });

  draw("DELIVER TO", b2x + 14, y - 16 * scale.sectionSpacing, { size: scale.tinyFont, bold: true, color: PRIMARY });
  let addrY = y - 32 * scale.sectionSpacing;
  for (const line of addrLines) {
    draw(line, b2x + 14, addrY, { size: scale.tinyFont, color: DARK });
    addrY -= 13 * scale.lineSpacing;
  }

  y -= boxH + 22 * scale.sectionSpacing;

  // ════════════════════════════════════════════════
  //  ITEMS TABLE
  // ════════════════════════════════════════════════
  const c1 = MARGIN;          // Item Description
  const c2 = MARGIN + CW * 0.56; // Pages
  const c3 = MARGIN + CW * 0.68; // Copies
  const c4 = MARGIN + CW * 0.78; // Amount

  // Track table start for outer border (before header)
  const tableStartY = y;

  // Table header (deep blue background)
  const thH = 24 * scale.sectionSpacing;
  box(MARGIN, y - thH, CW, thH, { fill: PRIMARY });
  draw("ITEM DESCRIPTION", c1 + 10, y - 16 * scale.sectionSpacing, { size: scale.tinyFont, bold: true, color: WHITE });
  draw("PAGES", c2 + 4, y - 16 * scale.sectionSpacing, { size: scale.tinyFont, bold: true, color: WHITE });
  draw("COPIES", c3 + 2, y - 16 * scale.sectionSpacing, { size: scale.tinyFont, bold: true, color: WHITE });
  draw("AMOUNT", c4 + 8, y - 16 * scale.sectionSpacing, { size: scale.tinyFont, bold: true, color: WHITE });
  y -= thH;

  // Table rows
  for (let idx = 0; idx < order.items.length; idx++) {
    const item = order.items[idx];
    const config = item.configuration || {};
    const pricing = item.pricing || {};

    // Build pricing breakdown lines
    const lines = [];
    lines.push({ l: "Base Price", r: `${fmt(pricing.basePricePerPage)}/page` });
    if (pricing.printTypePrice > 0) lines.push({ l: "Print Type", r: `+${fmt(pricing.printTypePrice)}/${pricing.printTypeIsPerCopy ? "copy" : "page"}` });
    if (pricing.paperSizePrice > 0) lines.push({ l: "Paper Size", r: `+${fmt(pricing.paperSizePrice)}/${pricing.paperSizeIsPerCopy ? "copy" : "page"}` });
    if (pricing.paperTypePrice > 0) lines.push({ l: "Paper Type", r: `+${fmt(pricing.paperTypePrice)}/${pricing.paperTypeIsPerCopy ? "copy" : "page"}` });
    if (pricing.gsmPrice > 0) lines.push({ l: "GSM", r: `+${fmt(pricing.gsmPrice)}/${pricing.gsmIsPerCopy ? "copy" : "page"}` });
    if (pricing.printSidePrice > 0) lines.push({ l: "Print Side", r: `+${fmt(pricing.printSidePrice)}/${pricing.printSideIsPerCopy ? "copy" : "page"}` });
    if (pricing.bindingPrice > 0) lines.push({ l: "Binding", r: `+${fmt(pricing.bindingPrice)}/${pricing.bindingIsPerCopy !== false ? "copy" : "page"}` });

    const rowH = (56 + lines.length * 12 + 14) * scale.sectionSpacing; // base + pricing lines + total line
    ensureSpace(rowH + 5);

    // Alternating row background
    if (idx % 2 === 0) {
      box(MARGIN, y - rowH, CW, rowH, { fill: rgb(0.99, 0.99, 1) });
    }

    let ry = y - 15 * scale.sectionSpacing;

    // Service name
    draw(item.serviceName || "", c1 + 10, ry, { size: scale.sectionFont, bold: true, color: DARK });
    ry -= 14 * scale.lineSpacing;

    // File name + page count
    const fileName = (item.fileName || "").length > 50 ? item.fileName.substring(0, 50) + "..." : item.fileName || "";
    draw(`${fileName} (${item.pageCount} pages)`, c1 + 10, ry, { size: scale.tinyFont, color: GRAY });
    ry -= 13 * scale.lineSpacing;

    // Configuration summary (matching old design: bullet separator, always show GSM)
    const parts = [config.printType, config.paperSize, config.paperType, config.gsm ? `${config.gsm}GSM` : "", config.printSide];
    if (config.bindingOption && config.bindingOption !== "none") parts.push(config.bindingOption);
    const configStr = parts.filter(Boolean).join(" - ");
    const truncConfig = configStr.length > 75 ? configStr.substring(0, 75) + "..." : configStr;
    draw(truncConfig, c1 + 10, ry, { size: scale.tinyFont, color: LIGHT_TEXT });
    ry -= 16 * scale.lineSpacing;

    // Pricing breakdown box with blue left accent
    const pBoxH = (lines.length * 12 + 18) * scale.sectionSpacing;
    const pBoxW = CW * 0.52;
    box(c1 + 10, ry - pBoxH + 10, pBoxW, pBoxH, { fill: BG_LIGHT });
    page.drawRectangle({ x: c1 + 10, y: ry - pBoxH + 10, width: 2.5, height: pBoxH, color: PRIMARY });

    let py = ry;
    for (const { l, r } of lines) {
      draw(l + ":", c1 + 18, py, { size: scale.tinyFont, color: GRAY });
      draw(r, c1 + 18 + pBoxW - 70, py, { size: scale.tinyFont, color: GRAY });
      py -= 12 * scale.lineSpacing;
    }
    // Total per page (bold, primary color)
    page.drawLine({ start: { x: c1 + 18, y: py + 8 }, end: { x: c1 + 10 + pBoxW - 8, y: py + 8 }, thickness: 0.5, color: BORDER });
    draw("Total per Page:", c1 + 18, py - 2, { size: scale.tinyFont, bold: true, color: PRIMARY });
    draw(fmt(pricing.pricePerPage), c1 + 18 + pBoxW - 70, py - 2, { size: scale.tinyFont, bold: true, color: PRIMARY });

    // Pages & Copies columns
    draw(String(item.pageCount || ""), c2 + 12, y - 15 * scale.sectionSpacing, { size: scale.bodyFont, color: DARK });
    draw(String(config.copies || 1), c3 + 12, y - 15 * scale.sectionSpacing, { size: scale.bodyFont, color: DARK });

    // Amount column
    draw(fmt(pricing.subtotal), c4 + 8, y - 15 * scale.sectionSpacing, { size: scale.sectionFont + 1, bold: true, color: PRIMARY });
    draw(`${item.pageCount} x ${config.copies || 1} x ${fmt(pricing.pricePerPage)}`, c4 + 8, y - 30 * scale.sectionSpacing, { size: scale.microFont, color: LIGHT_TEXT });

    y -= rowH;
    hLine(y, { color: BORDER });
    y -= 2;
  }

  // Table outer border
  box(MARGIN, y, CW, tableStartY - y, { border: BORDER, bw: 1 });

  y -= 18 * scale.sectionSpacing;

  // ════════════════════════════════════════════════
  //  TOTALS SECTION (right-aligned box)
  // ════════════════════════════════════════════════
  ensureSpace(130 * scale.sectionSpacing);

  const totW = 230 * scale.sectionSpacing;
  const totX = PAGE_WIDTH - MARGIN - totW;

  // Calculate totals box height
  let totLines = 1; // subtotal
  if (order.pricing.deliveryCharge > 0) totLines++;
  if (order.pricing.packingCharge > 0) totLines++;
  if (order.pricing.discount > 0) totLines++;
  totLines++; // final total
  const totH = totLines * 22 * scale.sectionSpacing + 28 * scale.sectionSpacing;

  // Background
  box(totX, y - totH, totW, totH, { fill: BG_LIGHT });
  box(totX, y - totH, totW, totH, { border: BORDER, bw: 0.5 });
  // Blue top accent
  page.drawRectangle({ x: totX, y: y, width: totW, height: 2, color: PRIMARY });

  let ty = y - 20 * scale.sectionSpacing;
  const tlx = totX + 16 * scale.sectionSpacing;
  const trx = totX + totW - 16 * scale.sectionSpacing;

  // Subtotal
  draw("Subtotal:", tlx, ty, { size: scale.sectionFont, bold: true, color: DARK });
  const subStr = fmt(order.pricing.subtotal);
  draw(subStr, trx - fontBold.widthOfTextAtSize(sanitize(subStr), scale.sectionFont), ty, { size: scale.sectionFont, bold: true, color: DARK });
  ty -= 6 * scale.sectionSpacing;
  page.drawLine({ start: { x: tlx, y: ty }, end: { x: trx, y: ty }, thickness: 0.5, color: BORDER });
  ty -= 16 * scale.sectionSpacing;

  // Delivery
  if (order.pricing.deliveryCharge > 0) {
    draw("Delivery:", tlx, ty, { size: scale.bodyFont, color: DARK });
    const ds = fmt(order.pricing.deliveryCharge);
    draw(ds, trx - fontBold.widthOfTextAtSize(sanitize(ds), scale.bodyFont), ty, { size: scale.bodyFont, bold: true, color: DARK });
    ty -= 20 * scale.sectionSpacing;
  }

  // Packing
  if (order.pricing.packingCharge > 0) {
    draw("Packing:", tlx, ty, { size: scale.bodyFont, color: DARK });
    const ps = fmt(order.pricing.packingCharge);
    draw(ps, trx - fontBold.widthOfTextAtSize(sanitize(ps), scale.bodyFont), ty, { size: scale.bodyFont, bold: true, color: DARK });
    ty -= 20 * scale.sectionSpacing;
  }

  // Discount
  if (order.pricing.discount > 0) {
    const couponLabel = `Discount (${order.pricing.couponCode || "Coupon"}):`;
    draw(couponLabel, tlx, ty, { size: scale.bodyFont, bold: true, color: GREEN });
    const ds = `-${fmt(order.pricing.discount)}`;
    draw(ds, trx - fontBold.widthOfTextAtSize(sanitize(ds), scale.bodyFont), ty, { size: scale.bodyFont, bold: true, color: GREEN });
    ty -= 20 * scale.sectionSpacing;
  }

  // Final total with blue accent line
  page.drawLine({ start: { x: tlx, y: ty + 8 }, end: { x: trx, y: ty + 8 }, thickness: 2, color: PRIMARY });
  ty -= 4;
  const totalFontSize = sizeKey === "a5" ? scale.sectionFont + 2 : scale.sectionFont + 4;
  const totalLabel = sizeKey === "a5" ? "Total:" : "Total Amount:";
  draw(totalLabel, tlx, ty, { size: totalFontSize, bold: true, color: PRIMARY });
  const totalStr = fmt(order.pricing.total);
  draw(totalStr, trx - fontBold.widthOfTextAtSize(sanitize(totalStr), totalFontSize), ty, { size: totalFontSize, bold: true, color: PRIMARY });

  y -= totH + 25 * scale.sectionSpacing;

  // ════════════════════════════════════════════════
  //  FOOTER
  // ════════════════════════════════════════════════
  const footerSpace = sizeKey === "a5" ? 60 : 80;
  ensureSpace(footerSpace * scale.sectionSpacing);
  hLine(y, { color: BORDER });
  y -= (sizeKey === "a5" ? 15 : 20) * scale.sectionSpacing;

  // Terms & Conditions (left)
  if (settings.termsAndConditions) {
    draw("TERMS & CONDITIONS", MARGIN, y, { size: scale.tinyFont, bold: true, color: PRIMARY });
    y -= (sizeKey === "a5" ? 10 : 13) * scale.lineSpacing;
    const termsMaxW = CW / 2 - 20;
    const termsLines = wrapText(settings.termsAndConditions, termsMaxW, { size: scale.tinyFont });
    const maxLines = sizeKey === "a5" ? 3 : 4;
    for (let i = 0; i < Math.min(termsLines.length, maxLines); i++) {
      draw(termsLines[i], MARGIN, y, { size: scale.tinyFont, color: GRAY });
      y -= (sizeKey === "a5" ? 9 : 11) * scale.lineSpacing;
    }
  }

  // Need Help (right)
  const helpX = MARGIN + CW / 2 + 10;
  const helpY = y + (settings.termsAndConditions ? (sizeKey === "a5" ? 25 : 35) * scale.sectionSpacing : 0);
  draw("NEED HELP?", helpX, helpY, { size: scale.tinyFont, bold: true, color: PRIMARY });
  draw(`Contact us at ${settings.companyPhone || ""} or email`, helpX, helpY - (sizeKey === "a5" ? 10 : 13) * scale.lineSpacing, { size: scale.tinyFont, color: GRAY });
  draw(`${settings.companyEmail || ""} for any queries or issues.`, helpX, helpY - (sizeKey === "a5" ? 20 : 25) * scale.lineSpacing, { size: scale.tinyFont, color: GRAY });

  // Copyright bar
  y -= (sizeKey === "a5" ? 6 : 8) * scale.sectionSpacing;
  hLine(y, { color: BORDER });
  y -= (sizeKey === "a5" ? 10 : 14) * scale.sectionSpacing;
  const copyText = sanitize(settings.footerNote || `(c) ${new Date().getFullYear()} ${settings.companyName}. All rights reserved.`);
  const copyW = font.widthOfTextAtSize(copyText, scale.tinyFont);
  draw(copyText, (PAGE_WIDTH - copyW) / 2, y, { size: scale.tinyFont, color: LIGHT_TEXT });

  return Buffer.from(await pdfDoc.save());
};
