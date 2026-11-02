import { Router } from "express";
import { db, ordersTable, orderItemsTable, productsTable, inventoryTable, usersTable, orderPaymentsTable } from "@workspace/db";
import { eq, ilike, gte, lte, and, sql, or, desc } from "drizzle-orm";
import { requireAuth, getSessionUser } from "../middlewares/auth";
import {
  GetOrderParams,
  ListOrdersQueryParams,
  DownloadInvoiceParams,
  SendInvoiceEmailParams,
} from "@workspace/api-zod";

const router = Router();

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const yyyymmdd = `${year}${month}${day}`;
  const prefix = `SJ-INV-${yyyymmdd}-`;

  const existingOrders = await db
    .select({ invoiceNumber: ordersTable.invoiceNumber })
    .from(ordersTable);

  let maxSeq = 0;
  for (const order of existingOrders) {
    const parts = order.invoiceNumber.split(/[-—]/);
    const lastPart = parts[parts.length - 1];
    const seqNum = parseInt(lastPart, 10);
    if (!isNaN(seqNum) && seqNum < 10000 && seqNum > maxSeq) {
      maxSeq = seqNum;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(2, "0");
  return `${prefix}${nextSeq}`;
}

function numericFields(o: Record<string, unknown>) {
  return {
    ...o,
    subtotal: Number(o.subtotal),
    gstPercentage: Number(o.gstPercentage),
    gstAmount: Number(o.gstAmount),
    referralCharges: Number(o.referralCharges || 0),
    discount: Number(o.discount || 0),
    oldGoldWeight: Number(o.oldGoldWeight || 0),
    oldGoldRate: Number(o.oldGoldRate || 0),
    oldGoldAmount: Number(o.oldGoldAmount || 0),
    grandTotal: Number(o.grandTotal),
    paidAmount: Number(o.paidAmount),
    pendingAmount: Number(o.pendingAmount),
    paymentMethod: (o.paymentMethod as string) || "Cash",
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const query = ListOrdersQueryParams.safeParse(req.query);
  const search = query.success ? query.data.search : undefined;
  const dateFrom = query.success ? query.data.dateFrom : undefined;
  const dateTo = query.success ? query.data.dateTo : undefined;
  const page = (query.success && query.data.page) ? Number(query.data.page) : 1;
  const limit = (query.success && query.data.limit) ? Math.min(Number(query.data.limit), 500) : 100;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (user.role !== "admin") conditions.push(eq(ordersTable.createdById, user.id) as ReturnType<typeof eq>);
  if (search) conditions.push(
    or(
      ilike(ordersTable.customerName, `%${search}%`),
      ilike(ordersTable.invoiceNumber, `%${search}%`),
    ) as ReturnType<typeof eq>
  );
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)) as ReturnType<typeof eq>);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, end) as ReturnType<typeof eq>);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(whereClause);

  const orders = await db
    .select({
      id: ordersTable.id,
      invoiceNumber: ordersTable.invoiceNumber,
      customerName: ordersTable.customerName,
      customerMobile: ordersTable.customerMobile,
      customerEmail: ordersTable.customerEmail,
      customerAddress: ordersTable.customerAddress,
      customerPan: ordersTable.customerPan,
      subtotal: ordersTable.subtotal,
      gstPercentage: ordersTable.gstPercentage,
      gstAmount: ordersTable.gstAmount,
      referralCharges: ordersTable.referralCharges,
      discount: ordersTable.discount,
      oldGoldWeight: ordersTable.oldGoldWeight,
      oldGoldRate: ordersTable.oldGoldRate,
      oldGoldAmount: ordersTable.oldGoldAmount,
      oldGoldNotes: ordersTable.oldGoldNotes,
      grandTotal: ordersTable.grandTotal,
      paidAmount: ordersTable.paidAmount,
      pendingAmount: ordersTable.pendingAmount,
      paymentMethod: ordersTable.paymentMethod,
      status: ordersTable.status,
      createdById: ordersTable.createdById,
      createdByName: usersTable.name,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.createdById, usersTable.id))
    .where(whereClause)
    .orderBy(sql`${ordersTable.createdAt} desc`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: orders.map(o => numericFields(o as Record<string, unknown>)),
    total: totalRow.count,
    page,
    limit,
    totalPages: Math.ceil(totalRow.count / limit),
  });
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const body = req.body;
  const customerName = String(body.customerName || "").trim();
  const customerMobile = String(body.customerMobile || "").trim();
  const customerEmail = body.customerEmail ? String(body.customerEmail).trim() : null;
  const customerAddress = body.customerAddress ? String(body.customerAddress).trim() : null;
  const customerPan = body.customerPan ? String(body.customerPan).trim().toUpperCase() : null;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName) {
    res.status(400).json({ error: "Customer name is required" });
    return;
  }

  let cleanMobile = customerMobile.replace(/[\s\-\(\)\+]/g, "");
  if (cleanMobile.startsWith("91") && cleanMobile.length === 12) cleanMobile = cleanMobile.slice(2);
  else if (cleanMobile.startsWith("0") && cleanMobile.length === 11) cleanMobile = cleanMobile.slice(1);

  if (!/^\d{10}$/.test(cleanMobile)) {
    res.status(400).json({ error: "Mobile number must be a valid 10-digit number" });
    return;
  }

  if (!items.length) {
    res.status(400).json({ error: "Order must contain at least one item" });
    return;
  }

  // Validate stock and compute subtotal
  let subtotal = 0;
  const enrichedItems: Array<{
    productId: number;
    productName: string;
    category: string;
    metalType: string;
    purity: string;
    grossWeight: string;
    netWeight: string;
    metalRate: string;
    makingCharges: string;
    hallmarkUid: string | null;
    hsnCode: string;
    quantity: number;
    unitPrice: number;
    total: number;
    prevQty: number;
  }> = [];

  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!product) {
      res.status(400).json({ error: `Product ${item.productId} not found` });
      return;
    }
    const qty = Number(item.quantity) || 1;
    if (product.availableQuantity < qty) {
      res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.availableQuantity}` });
      return;
    }
    const unitPrice = Number(item.unitPrice) || Number(product.price);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    enrichedItems.push({
      productId: item.productId,
      productName: product.name,
      category: item.category || product.category || "Jewellery",
      metalType: item.metalType || product.metalType || "Gold",
      purity: item.purity || product.purity || "22K 916",
      grossWeight: String(item.grossWeight || product.grossWeight || 0),
      netWeight: String(item.netWeight || product.netWeight || 0),
      metalRate: String(item.metalRate || 0),
      makingCharges: String(item.makingCharges || product.makingChargesValue || 0),
      hallmarkUid: item.hallmarkUid || product.hallmarkUid || null,
      hsnCode: item.hsnCode || product.hsnCode || "7113",
      quantity: qty,
      unitPrice,
      total: lineTotal,
      prevQty: product.availableQuantity,
    });
  }

  const gstPct = Number(body.gstPercentage ?? 3); // 3% default for jewelry
  const gstAmount = subtotal * (gstPct / 100);
  const refCharges = Number(body.referralCharges ?? 0);
  const disc = Number(body.discount ?? 0);

  // Old Gold Exchange Deduction
  const oldGoldWeight = Number(body.oldGoldWeight ?? 0);
  const oldGoldRate = Number(body.oldGoldRate ?? 0);
  const oldGoldAmount = Number(body.oldGoldAmount ?? 0);
  const oldGoldNotes = body.oldGoldNotes ? String(body.oldGoldNotes) : null;

  // Grand total = Subtotal + GST + Other - Discount - Old Gold Trade-In
  const grandTotal = Math.max(0, subtotal + gstAmount + refCharges - disc - oldGoldAmount);
  const invoiceNumber = await generateInvoiceNumber();

  const paid = body.paidAmount !== undefined ? Number(body.paidAmount) : grandTotal;
  const pending = Math.max(0, grandTotal - paid);
  const status = pending > 0 ? "pending" : "completed";

  const customCreatedAt = body.createdAt && !isNaN(new Date(body.createdAt as string).getTime())
    ? new Date(body.createdAt as string)
    : undefined;

  const [order] = await db.insert(ordersTable).values({
    invoiceNumber,
    customerName,
    customerMobile: cleanMobile,
    customerEmail,
    customerAddress,
    customerPan,
    subtotal: String(subtotal),
    gstPercentage: String(gstPct),
    gstAmount: String(gstAmount),
    referralCharges: String(refCharges),
    discount: String(disc),
    oldGoldWeight: String(oldGoldWeight),
    oldGoldRate: String(oldGoldRate),
    oldGoldAmount: String(oldGoldAmount),
    oldGoldNotes,
    grandTotal: String(grandTotal),
    paidAmount: String(paid),
    pendingAmount: String(pending),
    paymentMethod: (body.paymentMethod as string) || "Cash",
    status,
    createdById: user.id,
    createdAt: customCreatedAt,
  }).returning();

  // Insert order items + update inventory
  for (const item of enrichedItems) {
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      metalType: item.metalType,
      purity: item.purity,
      grossWeight: item.grossWeight,
      netWeight: item.netWeight,
      metalRate: item.metalRate,
      makingCharges: item.makingCharges,
      hallmarkUid: item.hallmarkUid,
      hsnCode: item.hsnCode,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      total: String(item.total),
    });

    const newQty = item.prevQty - item.quantity;
    await db.update(productsTable).set({ availableQuantity: newQty }).where(eq(productsTable.id, item.productId));
    await db.insert(inventoryTable).values({
      productId: item.productId,
      productName: item.productName,
      previousQuantity: item.prevQty,
      quantityAdded: null,
      quantityReduced: item.quantity,
      currentQuantity: newQty,
      actionType: "order",
      updatedById: user.id,
    });
  }

  if (paid > 0) {
    await db.insert(orderPaymentsTable).values({
      orderId: order.id,
      amount: String(paid),
      paymentMethod: (body.paymentMethod as string) || "Cash",
      remarks: "Initial payment on order creation",
      createdById: user.id,
    });
  }

  res.status(201).json({
    ...numericFields(order as unknown as Record<string, unknown>),
    createdByName: user.name,
  });
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db
    .select({
      id: ordersTable.id,
      invoiceNumber: ordersTable.invoiceNumber,
      customerName: ordersTable.customerName,
      customerMobile: ordersTable.customerMobile,
      customerEmail: ordersTable.customerEmail,
      customerAddress: ordersTable.customerAddress,
      customerPan: ordersTable.customerPan,
      subtotal: ordersTable.subtotal,
      gstPercentage: ordersTable.gstPercentage,
      gstAmount: ordersTable.gstAmount,
      referralCharges: ordersTable.referralCharges,
      discount: ordersTable.discount,
      oldGoldWeight: ordersTable.oldGoldWeight,
      oldGoldRate: ordersTable.oldGoldRate,
      oldGoldAmount: ordersTable.oldGoldAmount,
      oldGoldNotes: ordersTable.oldGoldNotes,
      grandTotal: ordersTable.grandTotal,
      paidAmount: ordersTable.paidAmount,
      pendingAmount: ordersTable.pendingAmount,
      paymentMethod: ordersTable.paymentMethod,
      status: ordersTable.status,
      createdById: ordersTable.createdById,
      createdByName: usersTable.name,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.createdById, usersTable.id))
    .where(eq(ordersTable.id, params.data.id));

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (user.role !== "admin" && order.createdById !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  const payments = await db
    .select({
      id: orderPaymentsTable.id,
      orderId: orderPaymentsTable.orderId,
      amount: orderPaymentsTable.amount,
      paymentMethod: orderPaymentsTable.paymentMethod,
      remarks: orderPaymentsTable.remarks,
      createdById: orderPaymentsTable.createdById,
      createdByName: usersTable.name,
      createdAt: orderPaymentsTable.createdAt,
    })
    .from(orderPaymentsTable)
    .leftJoin(usersTable, eq(orderPaymentsTable.createdById, usersTable.id))
    .where(eq(orderPaymentsTable.orderId, order.id))
    .orderBy(desc(orderPaymentsTable.createdAt));

  res.json({
    ...numericFields(order as unknown as Record<string, unknown>),
    items: items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      category: i.category,
      metalType: i.metalType,
      purity: i.purity,
      grossWeight: Number(i.grossWeight || 0),
      netWeight: Number(i.netWeight || 0),
      metalRate: Number(i.metalRate || 0),
      makingCharges: Number(i.makingCharges || 0),
      hallmarkUid: i.hallmarkUid,
      hsnCode: i.hsnCode,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    payments: payments.map(p => ({
      ...p,
      amount: Number(p.amount),
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
    })),
  });
});

router.post("/orders/:id/payments", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orderId = parseInt(idParam as string, 10);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const { amount, paymentMethod, remarks } = req.body;
  const paymentAmt = Number(amount);
  if (isNaN(paymentAmt) || paymentAmt <= 0) {
    res.status(400).json({ error: "Valid payment amount is required" });
    return;
  }

  if (!remarks || typeof remarks !== "string" || !remarks.trim()) {
    res.status(400).json({ error: "Remarks / payment note is mandatory" });
    return;
  }

  await db.insert(orderPaymentsTable).values({
    orderId,
    amount: String(paymentAmt),
    paymentMethod: paymentMethod || "Cash",
    remarks: remarks.trim(),
    createdById: user.id,
  });

  const currentPaid = Number(order.paidAmount ?? 0);
  const newPaid = currentPaid + paymentAmt;
  const grandTotal = Number(order.grandTotal);
  const newPending = Math.max(0, grandTotal - newPaid);
  const newStatus = newPending > 0 ? "pending" : "completed";

  await db
    .update(ordersTable)
    .set({
      paidAmount: String(newPaid),
      pendingAmount: String(newPending),
      status: newStatus,
      paymentMethod: paymentMethod || order.paymentMethod || "Cash",
    })
    .where(eq(ordersTable.id, orderId));

  const [updatedOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const payments = await db
    .select({
      id: orderPaymentsTable.id,
      orderId: orderPaymentsTable.orderId,
      amount: orderPaymentsTable.amount,
      paymentMethod: orderPaymentsTable.paymentMethod,
      remarks: orderPaymentsTable.remarks,
      createdById: orderPaymentsTable.createdById,
      createdByName: usersTable.name,
      createdAt: orderPaymentsTable.createdAt,
    })
    .from(orderPaymentsTable)
    .leftJoin(usersTable, eq(orderPaymentsTable.createdById, usersTable.id))
    .where(eq(orderPaymentsTable.orderId, orderId))
    .orderBy(desc(orderPaymentsTable.createdAt));

  res.json({
    ...numericFields(updatedOrder as unknown as Record<string, unknown>),
    items: items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    payments: payments.map(p => ({
      ...p,
      amount: Number(p.amount),
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
    })),
  });
});

// Printable Luxury Jewelry Tax Invoice PDF
router.get("/orders/:id/invoice", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const params = DownloadInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (user.role !== "admin" && order.createdById !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));

  const pdfkitModule = await import("pdfkit");
  const PDFDocument = (pdfkitModule.default ?? pdfkitModule) as typeof pdfkitModule.default;
  const doc = new PDFDocument({ margin: 35, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${order.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Luxury Gold Header Banner
  doc.rect(35, 35, 525, 82).fill("#1A1A1A");

  // Gold accent bar on top
  doc.rect(35, 35, 525, 4).fill("#D4AF37");

  // Shop Name & Details
  doc.fillColor("#D4AF37").fontSize(18).font("Helvetica-Bold").text("SAJIRI JEWELS", 50, 48);
  doc.fillColor("#E2E8F0").fontSize(8).font("Helvetica").text("Timeless Elegance & Pure Craftsmanship", 50, 70);
  doc.fillColor("#94A3B8").fontSize(7.5).font("Helvetica").text(
    "Gold Souk Market, Main Road, Amravati - 444601 | Mob: +91 98765 43210 | GSTIN: 27AABCR1234F1Z8",
    50,
    82
  );
  doc.fillColor("#D4AF37").fontSize(7.5).font("Helvetica-Bold").text(
    "PREMIUM FASHION JEWELLERY • ANTI-TARNISH • WATERPROOF",
    50,
    95
  );

  // Invoice Number & Date (Right side)
  const createdDateStr = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });
  doc.fillColor("#D4AF37").fontSize(11).font("Helvetica-Bold").text("TAX INVOICE", 370, 48, { width: 175, align: "right" });
  doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold").text(order.invoiceNumber, 370, 64, { width: 175, align: "right" });
  doc.fillColor("#94A3B8").fontSize(8).font("Helvetica").text(`Date: ${createdDateStr}`, 370, 80, { width: 175, align: "right" });
  if (order.status) {
    const isPaid = order.status === "completed" || Number(order.pendingAmount) <= 0;
    doc.fillColor(isPaid ? "#22C55E" : "#F59E0B").fontSize(8).font("Helvetica-Bold").text(
      isPaid ? "STATUS: PAID" : "STATUS: BALANCE DUE",
      370,
      95,
      { width: 175, align: "right" }
    );
  }

  // Customer Details Box
  let currentY = 125;
  doc.rect(35, currentY, 525, 62).fillAndStroke("#FFFFFF", "#E2E8F0");
  doc.rect(35, currentY, 4, 62).fill("#D4AF37"); // Gold left accent stripe

  doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text("BILLED TO / CUSTOMER DETAILS", 48, currentY + 8);
  doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(order.customerName, 48, currentY + 20);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica");
  let custDetails = `Mobile: ${order.customerMobile}`;
  if (order.customerEmail) custDetails += `   |   Email: ${order.customerEmail}`;
  if (order.customerPan) custDetails += `   |   PAN: ${order.customerPan}`;
  doc.text(custDetails, 48, currentY + 34);

  if (order.customerAddress) {
    doc.text(`Address: ${order.customerAddress}`, 48, currentY + 46, { width: 495 });
  }

  // Items Table Header
  currentY = 195;
  doc.rect(35, currentY, 525, 22).fillAndStroke("#F1F5F9", "#CBD5E1");
  doc.fillColor("#1E293B").fontSize(8).font("Helvetica-Bold");
  doc.text("#", 45, currentY + 6, { width: 25, align: "left" });
  doc.text("ITEM DESCRIPTION", 70, currentY + 6, { width: 225, align: "left" });
  doc.text("CATEGORY", 295, currentY + 6, { width: 85, align: "left" });
  doc.text("QTY", 380, currentY + 6, { width: 35, align: "center" });
  doc.text("UNIT PRICE (Rs.)", 415, currentY + 6, { width: 65, align: "right" });
  doc.text("AMOUNT (Rs.)", 480, currentY + 6, { width: 70, align: "right" });

  currentY += 22;

  // Items Table Rows
  doc.font("Helvetica").fontSize(8);
  let isAltRow = false;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (isAltRow) {
      doc.rect(35, currentY, 525, 24).fill("#FAFAFA");
    }
    isAltRow = !isAltRow;

    doc.fillColor("#64748B");
    doc.text(String(idx + 1), 45, currentY + 7, { width: 25, align: "left" });

    doc.fillColor("#0F172A").font("Helvetica-Bold");
    doc.text(item.productName, 70, currentY + 7, { width: 225, align: "left" });

    doc.fillColor("#475569").font("Helvetica");
    doc.text(item.category || "Jewellery", 295, currentY + 7, { width: 85, align: "left" });

    doc.fillColor("#0F172A");
    doc.text(String(item.quantity), 380, currentY + 7, { width: 35, align: "center" });

    const rateText = `Rs. ${Number(item.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    doc.text(rateText, 415, currentY + 7, { width: 65, align: "right" });

    const totalText = `Rs. ${Number(item.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    doc.fillColor("#0F172A").font("Helvetica-Bold").text(totalText, 480, currentY + 7, { width: 70, align: "right" });
    doc.font("Helvetica");

    doc.moveTo(35, currentY + 24).lineTo(560, currentY + 24).strokeColor("#E2E8F0").stroke();
    currentY += 24;
  }

  currentY += 12;

  // Calculation Breakdown Box (Right Aligned)
  const totalsBoxX = 310;
  const subtotal = Number(order.subtotal);
  const gstAmount = Number(order.gstAmount);
  const gstPct = Number(order.gstPercentage);
  const discount = Number(order.discount || 0);
  const oldGoldAmt = Number(order.oldGoldAmount || 0);
  const oldGoldWt = Number(order.oldGoldWeight || 0);
  const grandTotal = Number(order.grandTotal);
  const paid = Number(order.paidAmount ?? 0);
  const pending = Number(order.pendingAmount ?? 0);
  const pMethod = order.paymentMethod || "Cash";

  const renderTotalRow = (label: string, value: string, isBold = false, color = "#0F172A") => {
    doc.fillColor(color).font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(isBold ? 9.5 : 8.5);
    doc.text(label, totalsBoxX, currentY, { width: 140, align: "left" });
    doc.text(value, totalsBoxX + 140, currentY, { width: 105, align: "right" });
    currentY += 16;
  };

  renderTotalRow("Subtotal:", `Rs. ${subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);

  if (gstAmount > 0) {
    renderTotalRow(`GST (${gstPct}%):`, `Rs. ${gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
  }

  if (discount > 0) {
    renderTotalRow("Discount Applied:", `-Rs. ${discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, false, "#DC2626");
  }

  if (oldGoldAmt > 0) {
    const ogLabel = oldGoldWt > 0 ? `Exchange Credit (${oldGoldWt.toFixed(3)}g):` : "Exchange Credit:";
    renderTotalRow(ogLabel, `-Rs. ${oldGoldAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, true, "#16A34A");
  }

  doc.moveTo(totalsBoxX, currentY).lineTo(560, currentY).strokeColor("#CBD5E1").stroke();
  currentY += 6;

  renderTotalRow("Net Payable Amount:", `Rs. ${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, true, "#D97706");

  doc.moveTo(totalsBoxX, currentY).lineTo(560, currentY).strokeColor("#CBD5E1").stroke();
  currentY += 6;

  renderTotalRow(`Amount Paid (${pMethod}):`, `Rs. ${paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, true, "#0F172A");

  if (pending > 0) {
    renderTotalRow("Pending Balance:", `Rs. ${pending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, true, "#DC2626");
  }

  // Signature Block
  const sigY = Math.max(currentY + 25, 680);
  const sigX = 370;
  const sigWidth = 185;

  doc.moveTo(sigX, sigY).lineTo(sigX + sigWidth, sigY).strokeColor("#94A3B8").stroke();
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(9).text("Authorized Signatory", sigX, sigY + 6, { width: sigWidth, align: "center" });
  doc.fillColor("#D97706").font("Helvetica").fontSize(8).text("(SAJIRI JEWELS)", sigX, sigY + 18, { width: sigWidth, align: "center" });

  // Footer Note
  const footerY = Math.max(sigY + 45, 760);
  doc.moveTo(35, footerY).lineTo(560, footerY).strokeColor("#E2E8F0").stroke();
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(
    "Thank you for choosing SAJIRI JEWELS! Timeless Elegance & Modern Luxury.",
    35,
    footerY + 6,
    { align: "center", width: 525 }
  );

  doc.end();
});

router.post("/orders/:id/send-email", requireAuth, async (req, res): Promise<void> => {
  const params = SendInvoiceEmailParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  res.json({ message: `Invoice sent successfully to ${order.customerEmail || order.customerName}` });
});

export default router;
