import mammoth from 'mammoth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Try to import libreoffice-convert (optional - requires LibreOffice installed)
let libreConvert = null;
try {
  const libre = await import('libreoffice-convert');
  libreConvert = promisify(libre.default.convert);
} catch (e) {
  // LibreOffice converter not available, using fallback method
}

/**
 * Clean text to remove unsupported Unicode characters for PDF rendering
 */
function cleanTextForPdf(text) {
  return text
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[⭐★☆]/g, '*')
    .replace(/[•●○]/g, '*')
    .replace(/[…]/g, '...')
    .replace(/[©]/g, '(c)')
    .replace(/[®]/g, '(R)')
    .replace(/[™]/g, '(TM)')
    .replace(/[€]/g, 'EUR')
    .replace(/[£]/g, 'GBP')
    .replace(/[¥]/g, 'JPY')
    .replace(/[°]/g, ' deg ')
    .replace(/[±]/g, '+/-')
    .replace(/[×]/g, 'x')
    .replace(/[÷]/g, '/')
    .replace(/[←→↑↓↔]/g, '->')
    .replace(/[✓✔☑]/g, '[v]')
    .replace(/[✗✘☒]/g, '[x]')
    .replace(/[½]/g, '1/2')
    .replace(/[¼]/g, '1/4')
    .replace(/[¾]/g, '3/4')
    .replace(/[\u00A0]/g, ' ')  // Non-breaking space
    .replace(/[\u2003]/g, ' ')  // Em space
    .replace(/[\u2002]/g, ' ')  // En space
    .replace(/[^\x00-\x7F]/g, '');  // Remove remaining non-ASCII
}

/**
 * Method 1: Try LibreOffice conversion (most accurate if available)
 */
async function convertWithLibreOffice(buffer) {
  if (!libreConvert) {
    throw new Error('LibreOffice not available');
  }
  
  const pdfBuffer = await libreConvert(buffer, '.pdf', undefined);
  return pdfBuffer;
}

/**
 * Method 2: Enhanced Mammoth + PDF-lib conversion with table support
 */
async function convertWithMammoth(buffer) {
  // Convert Word to HTML with comprehensive style mapping
  const options = {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Heading 5'] => h5:fresh",
      "p[style-name='Heading 6'] => h6:fresh",
      "p[style-name='Title'] => h1.title:fresh",
      "p[style-name='Subtitle'] => h2.subtitle:fresh",
      "p[style-name='Quote'] => blockquote:fresh",
      "p[style-name='List Paragraph'] => p.list:fresh",
      "r[style-name='Strong'] => strong",
      "r[style-name='Emphasis'] => em",
      "u => u",
      "strike => s"
    ],
    includeDefaultStyleMap: true,
    convertImage: mammoth.images.inline(async (element) => {
      const imageBuffer = await element.read("base64");
      return {
        src: `data:${element.contentType};base64,${imageBuffer}`
      };
    })
  };
  
  const result = await mammoth.convertToHtml({ buffer }, options);
  const html = result.value;
  
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed all font variants
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
  };
  
  // Page settings (A4)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = { top: 50, bottom: 50, left: 50, right: 50 };
  const contentWidth = pageWidth - margin.left - margin.right;
  const contentHeight = pageHeight - margin.top - margin.bottom;
  
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin.top;
  
  // Parse state
  let currentFont = fonts.regular;
  let fontSize = 11;
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let alignment = 'left';
  let listLevel = 0;
  let inList = false;
  
  // Table state
  let inTable = false;
  let inTableRow = false;
  let inTableCell = false;
  let tableData = [];
  let currentRow = [];
  let currentCellContent = '';
  let tableColumnWidths = [];
  
  // Helper to get current font based on state
  const getCurrentFont = () => {
    if (isBold && isItalic) return fonts.boldItalic;
    if (isBold) return fonts.bold;
    if (isItalic) return fonts.italic;
    return fonts.regular;
  };
  
  // Helper to ensure we have space on page
  const ensureSpace = (neededHeight) => {
    if (y < margin.bottom + neededHeight) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin.top;
    }
  };
  
  // Helper to draw text with word wrap
  const drawWrappedText = (text, x, maxWidth, lineHeight) => {
    const words = text.split(/\s+/);
    let line = '';
    const lines = [];
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const width = getCurrentFont().widthOfTextAtSize(testLine, fontSize);
      
      if (width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    
    for (const lineText of lines) {
      ensureSpace(lineHeight);
      
      let drawX = x;
      const lineWidth = getCurrentFont().widthOfTextAtSize(lineText, fontSize);
      
      if (alignment === 'center') {
        drawX = x + (maxWidth - lineWidth) / 2;
      } else if (alignment === 'right') {
        drawX = x + maxWidth - lineWidth;
      }
      
      currentPage.drawText(lineText, {
        x: drawX,
        y,
        size: fontSize,
        font: getCurrentFont(),
        color: rgb(0, 0, 0)
      });
      
      if (isUnderline) {
        currentPage.drawLine({
          start: { x: drawX, y: y - 2 },
          end: { x: drawX + lineWidth, y: y - 2 },
          thickness: 0.5,
          color: rgb(0, 0, 0)
        });
      }
      
      y -= lineHeight;
    }
    
    return lines.length;
  };
  
  // Helper to draw a table
  const drawTable = (tableRows) => {
    if (!tableRows || tableRows.length === 0) return;
    
    const tableFontSize = 9;
    const cellPadding = 4;
    const lineHeight = tableFontSize * 1.3;
    const borderWidth = 0.5;
    
    // Calculate column count from the row with most cells
    const columnCount = Math.max(...tableRows.map(row => row.length));
    if (columnCount === 0) return;
    
    // Calculate column widths (equal distribution)
    const colWidth = contentWidth / columnCount;
    
    // Calculate row heights based on content
    const rowHeights = tableRows.map(row => {
      let maxLines = 1;
      row.forEach((cell, colIndex) => {
        const cellText = cleanTextForPdf(cell || '');
        const cellWidth = colWidth - (cellPadding * 2);
        const words = cellText.split(/\s+/);
        let line = '';
        let lines = 1;
        
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const width = fonts.regular.widthOfTextAtSize(testLine, tableFontSize);
          if (width > cellWidth && line) {
            lines++;
            line = word;
          } else {
            line = testLine;
          }
        }
        maxLines = Math.max(maxLines, lines);
      });
      return (maxLines * lineHeight) + (cellPadding * 2);
    });
    
    // Calculate total table height
    const totalTableHeight = rowHeights.reduce((sum, h) => sum + h, 0);
    
    // Check if table fits on current page, if not start new page
    if (y - totalTableHeight < margin.bottom) {
      // If table is too big for one page, we'll draw it across pages
      if (totalTableHeight > contentHeight) {
        // Table spans multiple pages - draw row by row
      } else {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin.top;
      }
    }
    
    // Draw table
    let tableY = y;
    
    tableRows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      
      // Check if row fits on current page
      if (tableY - rowHeight < margin.bottom) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        tableY = pageHeight - margin.top;
      }
      
      // Draw cells
      row.forEach((cell, colIndex) => {
        const cellX = margin.left + (colIndex * colWidth);
        const cellText = cleanTextForPdf(cell || '');
        
        // Draw cell border
        currentPage.drawRectangle({
          x: cellX,
          y: tableY - rowHeight,
          width: colWidth,
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: borderWidth,
          color: rowIndex === 0 ? rgb(0.95, 0.95, 0.95) : undefined // Header background
        });
        
        // Draw cell text with word wrap
        const cellWidth = colWidth - (cellPadding * 2);
        const words = cellText.split(/\s+/);
        let line = '';
        const lines = [];
        
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const width = fonts.regular.widthOfTextAtSize(testLine, tableFontSize);
          if (width > cellWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) lines.push(line);
        
        // Draw text lines
        let textY = tableY - cellPadding - tableFontSize;
        const font = rowIndex === 0 ? fonts.bold : fonts.regular;
        
        lines.forEach(lineText => {
          if (textY > tableY - rowHeight + cellPadding) {
            currentPage.drawText(lineText, {
              x: cellX + cellPadding,
              y: textY,
              size: tableFontSize,
              font: font,
              color: rgb(0, 0, 0)
            });
            textY -= lineHeight;
          }
        });
      });
      
      tableY -= rowHeight;
    });
    
    y = tableY - 10; // Add some space after table
  };
  
  // Parse HTML segments
  const segments = html.split(/(<[^>]+>)/g).filter(s => s);
  
  for (const segment of segments) {
    if (segment.startsWith('<')) {
      const tag = segment.toLowerCase();
      const tagName = tag.match(/<\/?([a-z0-9]+)/)?.[1] || '';
      
      // Handle opening tags
      if (!tag.startsWith('</')) {
        switch (tagName) {
          case 'table':
            inTable = true;
            tableData = [];
            y -= 10; // Space before table
            break;
          case 'tr':
            inTableRow = true;
            currentRow = [];
            break;
          case 'td':
          case 'th':
            inTableCell = true;
            currentCellContent = '';
            break;
          case 'h1':
            y -= 20;
            fontSize = 20;
            isBold = true;
            break;
          case 'h2':
            y -= 16;
            fontSize = 16;
            isBold = true;
            break;
          case 'h3':
            y -= 12;
            fontSize = 14;
            isBold = true;
            break;
          case 'h4':
          case 'h5':
          case 'h6':
            y -= 10;
            fontSize = 12;
            isBold = true;
            break;
          case 'p':
            if (!inTableCell) {
              y -= 8;
              if (tag.includes('center')) alignment = 'center';
              else if (tag.includes('right')) alignment = 'right';
            }
            break;
          case 'strong':
          case 'b':
            isBold = true;
            break;
          case 'em':
          case 'i':
            isItalic = true;
            break;
          case 'u':
            isUnderline = true;
            break;
          case 'ul':
          case 'ol':
            if (!inTableCell) {
              inList = true;
              listLevel++;
            }
            break;
          case 'li':
            if (!inTableCell) {
              y -= 4;
              // Draw bullet
              const bulletX = margin.left + (listLevel - 1) * 20;
              ensureSpace(20);
              currentPage.drawText('•', {
                x: bulletX,
                y,
                size: 10,
                font: fonts.bold,
                color: rgb(0, 0, 0)
              });
            }
            break;
          case 'br':
            if (inTableCell) {
              currentCellContent += ' ';
            } else {
              y -= fontSize * 1.2;
            }
            break;
          case 'img':
            if (!inTableCell) {
              // Handle embedded images
              const srcMatch = segment.match(/src="([^"]+)"/);
              if (srcMatch) {
                try {
                  const dataUrl = srcMatch[1];
                  if (dataUrl.startsWith('data:')) {
                    const base64Data = dataUrl.split(',')[1];
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    
                    let image;
                    if (dataUrl.includes('image/png')) {
                      image = await pdfDoc.embedPng(imageBuffer);
                    } else {
                      image = await pdfDoc.embedJpg(imageBuffer);
                    }
                    
                    const { width, height } = image.scale(1);
                    const scale = Math.min(contentWidth / width, 1, 300 / height);
                    const imgWidth = width * scale;
                    const imgHeight = height * scale;
                    
                    ensureSpace(imgHeight);
                    
                    let imgX = margin.left;
                    if (alignment === 'center') {
                      imgX = margin.left + (contentWidth - imgWidth) / 2;
                    }
                    
                    currentPage.drawImage(image, {
                      x: imgX,
                      y: y - imgHeight,
                      width: imgWidth,
                      height: imgHeight
                    });
                    
                    y -= imgHeight + 10;
                  }
                } catch (imgErr) {
                }
              }
            }
            break;
        }
      } else {
        // Handle closing tags
        switch (tagName) {
          case 'table':
            inTable = false;
            // Draw the collected table
            drawTable(tableData);
            tableData = [];
            break;
          case 'tr':
            inTableRow = false;
            if (currentRow.length > 0) {
              tableData.push(currentRow);
            }
            currentRow = [];
            break;
          case 'td':
          case 'th':
            inTableCell = false;
            currentRow.push(currentCellContent.trim());
            currentCellContent = '';
            break;
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            y -= 12;
            fontSize = 11;
            isBold = false;
            break;
          case 'p':
            if (!inTableCell) {
              y -= 8;
              alignment = 'left';
            }
            break;
          case 'strong':
          case 'b':
            isBold = false;
            break;
          case 'em':
          case 'i':
            isItalic = false;
            break;
          case 'u':
            isUnderline = false;
            break;
          case 'ul':
          case 'ol':
            if (!inTableCell) {
              listLevel = Math.max(0, listLevel - 1);
              if (listLevel === 0) inList = false;
              y -= 6;
            }
            break;
          case 'li':
            if (!inTableCell) {
              y -= 4;
            }
            break;
        }
      }
    } else {
      // Text content
      const cleanText = cleanTextForPdf(
        segment
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
      ).trim();
      
      if (cleanText) {
        if (inTableCell) {
          // Accumulate text for table cell
          currentCellContent += (currentCellContent ? ' ' : '') + cleanText;
        } else {
          // Draw text normally
          const indent = inList ? (listLevel * 20 + 15) : 0;
          const x = margin.left + indent;
          const maxWidth = contentWidth - indent;
          const lineHeight = fontSize * 1.4;
          
          drawWrappedText(cleanText, x, maxWidth, lineHeight);
        }
      }
    }
  }
  
  return await pdfDoc.save();
}


/**
 * Convert plain text to PDF
 */
async function convertTextToPdf(text) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const fontSize = 11;
  const lineHeight = fontSize * 1.4;
  const contentWidth = pageWidth - (margin * 2);
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    const cleanLine = cleanTextForPdf(line);
    const words = cleanLine.split(/\s+/);
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      
      if (width > contentWidth && currentLine) {
        // Draw current line
        if (y < margin + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        
        page.drawText(currentLine, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
        
        y -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw remaining text
    if (currentLine) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      
      page.drawText(currentLine, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      });
      
      y -= lineHeight;
    }
  }
  
  return await pdfDoc.save();
}

/**
 * Convert file buffer to PDF - reusable function for order uploads
 * @param {Buffer} buffer - File buffer
 * @param {string} extension - File extension (docx, doc, txt, etc.)
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const convertFileToPdf = async (buffer, extension) => {
  const ext = extension.toLowerCase().replace('.', '');
  
  // If already PDF, return as is
  if (ext === 'pdf') {
    return buffer;
  }
  
  // Ensure buffer is a proper Buffer instance
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Invalid buffer provided for conversion');
  }
  
  // Validate buffer has content
  if (buffer.length === 0) {
    throw new Error('Empty buffer provided for conversion');
  }
  
  let pdfBuffer;
  
  // Handle Word documents
  if (ext === 'docx' || ext === 'doc') {
    // Try LibreOffice first (most accurate)
    if (libreConvert) {
      try {
        pdfBuffer = await convertWithLibreOffice(buffer);
        return pdfBuffer;
      } catch (libreErr) {
        // LibreOffice conversion failed, falling back to Mammoth
      }
    }

    // Fallback to Mammoth + PDF-lib
    try {
      pdfBuffer = await convertWithMammoth(buffer);
      return pdfBuffer;
    } catch (mammothErr) {
      throw new Error(`Failed to convert ${ext} file: ${mammothErr.message}`);
    }
  }
  
  // Handle text files
  if (ext === 'txt') {
    const text = buffer.toString('utf-8');
    pdfBuffer = await convertTextToPdf(text);
    return pdfBuffer;
  }
  
  // For unsupported formats, throw error
  throw new Error(`Unsupported file format: ${ext}. Supported formats: PDF, DOCX, DOC, TXT`);
};

/**
 * Convert Word document to PDF - tries multiple methods for best accuracy
 */
export const convertWordToPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname } = req.file;
    
    // Validate file type
    const ext = path.extname(originalname).toLowerCase();
    if (ext !== '.docx' && ext !== '.doc') {
      return res.status(400).json({ error: 'File must be a Word document (.doc or .docx)' });
    }

    let pdfBuffer;
    let conversionMethod = 'mammoth';
    
    // Try LibreOffice first (most accurate)
    if (libreConvert) {
      try {
        pdfBuffer = await convertWithLibreOffice(buffer);
        conversionMethod = 'libreoffice';
      } catch (libreErr) {
        // LibreOffice conversion failed, falling back to Mammoth
      }
    }
    
    // Fallback to Mammoth + PDF-lib
    if (!pdfBuffer) {
      pdfBuffer = await convertWithMammoth(buffer);
    }
    
    // Load PDF to get page count
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    // Return PDF data and page count
    res.json({
      success: true,
      pageCount,
      pdfData: Buffer.from(pdfBuffer).toString('base64'),
      originalName: originalname,
      convertedName: originalname.replace(/\.(docx?|doc)$/i, '.pdf'),
      conversionMethod
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to convert Word document to PDF',
      details: error.message 
    });
  }
};

/**
 * Get page count from uploaded file
 */
export const getFilePageCount = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype } = req.file;
    
    // PDF files - count pages directly
    if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
      const pdfDoc = await PDFDocument.load(buffer);
      return res.json({
        success: true,
        pageCount: pdfDoc.getPageCount(),
        fileType: 'pdf'
      });
    }
    
    // Word documents - convert and count
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        originalname.toLowerCase().endsWith('.docx') ||
        originalname.toLowerCase().endsWith('.doc')) {
      
      let pdfBuffer;
      
      // Try LibreOffice first
      if (libreConvert) {
        try {
          pdfBuffer = await convertWithLibreOffice(buffer);
        } catch (e) {
          // Fallback to Mammoth
        }
      }
      
      if (!pdfBuffer) {
        pdfBuffer = await convertWithMammoth(buffer);
      }
      
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      return res.json({
        success: true,
        pageCount: pdfDoc.getPageCount(),
        fileType: 'word'
      });
    }
    
    // Other file types - return 1 page
    return res.json({
      success: true,
      pageCount: 1,
      fileType: 'other'
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to count pages',
      details: error.message 
    });
  }
};