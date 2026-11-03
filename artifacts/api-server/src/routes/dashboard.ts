import { Router } from "express";
import { db, usersTable, productsTable, ordersTable, orderItemsTable, orderPaymentsTable, inventoryTable } from "@workspace/db";
import { sql, lte, gte, and, desc, eq, inArray } from "drizzle-orm";
import { requireAuth, getSessionUser } from "../middlewares/auth";

const router = Router();

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// ============================================================================
// 1. GET /api/dashboard/admin (and /api/dashboard/overview)
// Comprehensive Shop Owner KPI Metrics, Profitability, Inventory Health & Alerts
// ============================================================================
router.get(["/dashboard/admin", "/dashboard/overview"], requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const isAdmin = user.role === "admin";
  const { dateFrom, dateTo, lowStockThreshold: rawThreshold } = req.query;
  const threshold = Math.max(1, Number(rawThreshold) || 2);

  // Time boundaries
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0 = Monday
  const thisWeekStart = new Date(todayStart);
  thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Filtered conditions for orders (strictly excludes cancelled or refunded orders)
  const orderConditions: ReturnType<typeof sql>[] = [
    sql`o.status NOT IN ('cancelled', 'refunded')`,
  ];
  if (dateFrom && typeof dateFrom === "string" && dateFrom.trim()) {
    const dFrom = new Date(`${dateFrom.trim()}T00:00:00.000Z`);
    if (!isNaN(dFrom.getTime())) orderConditions.push(sql`o.created_at >= ${dFrom}`);
  }
  if (dateTo && typeof dateTo === "string" && dateTo.trim()) {
    const dTo = new Date(`${dateTo.trim()}T23:59:59.999Z`);
    if (!isNaN(dTo.getTime())) orderConditions.push(sql`o.created_at <= ${dTo}`);
  }

  const orderWhereSql = orderConditions.length > 0 ? sql` WHERE ${sql.join(orderConditions, sql` AND `)}` : sql``;

  // 1. All Sales & Payment KPIs
  const [salesSummary] = await db.select({
    totalSales: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') then ${ordersTable.grandTotal}::numeric else 0 end), 0)::float`,
    todaySales: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${todayStart} and ${ordersTable.createdAt} <= ${todayEnd} then ${ordersTable.grandTotal}::numeric end), 0)::float`,
    yesterdaySales: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${yesterdayStart} and ${ordersTable.createdAt} <= ${yesterdayEnd} then ${ordersTable.grandTotal}::numeric end), 0)::float`,
    thisWeekSales: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${thisWeekStart} then ${ordersTable.grandTotal}::numeric end), 0)::float`,
    thisMonthSales: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${thisMonthStart} then ${ordersTable.grandTotal}::numeric end), 0)::float`,
    lastMonthSales: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${lastMonthStart} and ${ordersTable.createdAt} <= ${lastMonthEnd} then ${ordersTable.grandTotal}::numeric end), 0)::float`,
    thisYearSales: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${thisYearStart} then ${ordersTable.grandTotal}::numeric end), 0)::float`,

    totalOrders: sql<number>`count(case when ${ordersTable.status} not in ('cancelled', 'refunded') then 1 end)::int`,
    todayOrders: sql<number>`count(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${todayStart} and ${ordersTable.createdAt} <= ${todayEnd} then 1 end)::int`,
    yesterdayOrders: sql<number>`count(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${yesterdayStart} and ${ordersTable.createdAt} <= ${yesterdayEnd} then 1 end)::int`,
    thisMonthOrders: sql<number>`count(case when ${ordersTable.status} not in ('cancelled', 'refunded') and ${ordersTable.createdAt} >= ${thisMonthStart} then 1 end)::int`,

    allTimeCollected: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') then ${ordersTable.paidAmount}::numeric else 0 end), 0)::float`,
    allTimePending: sql<number>`coalesce(sum(case when ${ordersTable.status} not in ('cancelled', 'refunded') then ${ordersTable.pendingAmount}::numeric else 0 end), 0)::float`,
  }).from(ordersTable);

  // 2. Filtered orders summary (for active date range)
  const filteredOrdersRaw = await db.execute(sql`
    SELECT
      count(*)::int AS "filteredOrders",
      coalesce(sum(o.grand_total::numeric), 0)::float AS "filteredSales",
      coalesce(sum(o.paid_amount::numeric), 0)::float AS "filteredPaid",
      coalesce(sum(o.pending_amount::numeric), 0)::float AS "filteredPending",
      coalesce(sum(case when o.payment_method = 'Cash' then o.paid_amount::numeric else 0 end), 0)::float AS "cashCollected",
      coalesce(sum(case when o.payment_method = 'UPI' then o.paid_amount::numeric else 0 end), 0)::float AS "upiCollected",
      coalesce(sum(case when o.payment_method not in ('Cash', 'UPI') then o.paid_amount::numeric else 0 end), 0)::float AS "otherCollected",
      count(case when o.pending_amount::numeric > 0 then 1 end)::int AS "unpaidOrdersCount"
    FROM orders o
    ${orderWhereSql}
  `);

  const fRow = (filteredOrdersRaw.rows[0] as Record<string, unknown>) || {};
  const filteredOrders = Number(fRow.filteredOrders || 0);
  const filteredSales = Number(fRow.filteredSales || 0);
  const filteredPaid = Number(fRow.filteredPaid || 0);
  const filteredPending = Number(fRow.filteredPending || 0);
  const cashCollected = Number(fRow.cashCollected || 0);
  const upiCollected = Number(fRow.upiCollected || 0);
  const otherCollected = Number(fRow.otherCollected || 0);
  const unpaidOrdersCount = Number(fRow.unpaidOrdersCount || 0);
  const avgOrderValue = filteredOrders > 0 ? filteredSales / filteredOrders : 0;

  // 3. Profitability & COGS (Admin Only)
  let grossProfit = 0;
  let totalCogs = 0;
  let grossProfitMargin = 0;
  let itemRevenue = 0;
  let itemsSold = 0;
  let itemsWithMissingCost = 0;
  let costCoveragePercent = 100;
  let avgItemsPerOrder = 0;

  if (isAdmin) {
    const profitRaw = await db.execute(sql`
      SELECT
        coalesce(sum(oi.total::numeric), 0)::float AS "itemRevenue",
        coalesce(sum(oi.quantity * coalesce(p.supplier_cost::numeric, 0)), 0)::float AS "totalCogs",
        coalesce(sum(oi.total::numeric - (oi.quantity * coalesce(p.supplier_cost::numeric, 0))), 0)::float AS "grossProfit",
        count(*)::int AS "orderItemsCount",
        coalesce(sum(oi.quantity), 0)::int AS "totalUnitsSold",
        count(case when p.supplier_cost is null or p.supplier_cost::numeric <= 0 then 1 end)::int AS "missingCostItems"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      ${orderWhereSql}
    `);

    const pRow = (profitRaw.rows[0] as Record<string, unknown>) || {};
    itemRevenue = Number(pRow.itemRevenue || 0);
    totalCogs = Number(pRow.totalCogs || 0);
    grossProfit = Number(pRow.grossProfit || 0);
    itemsSold = Number(pRow.totalUnitsSold || 0);
    itemsWithMissingCost = Number(pRow.missingCostItems || 0);
    grossProfitMargin = itemRevenue > 0 ? (grossProfit / itemRevenue) * 100 : 0;
    costCoveragePercent = itemsSold > 0 ? Math.round(((itemsSold - itemsWithMissingCost) / itemsSold) * 100) : 100;
    avgItemsPerOrder = filteredOrders > 0 ? itemsSold / filteredOrders : 0;
  }

  // 4. Inventory Health (Live Warehouse Snapshot)
  const [invHealth] = await db.select({
    totalProducts: sql<number>`count(*)::int`,
    activeProducts: sql<number>`count(case when ${productsTable.isActive} = true then 1 end)::int`,
    inactiveProducts: sql<number>`count(case when ${productsTable.isActive} = false then 1 end)::int`,
    totalStockUnits: sql<number>`coalesce(sum(${productsTable.availableQuantity}), 0)::int`,
    lowStockCount: sql<number>`count(case when ${productsTable.availableQuantity} > 0 and ${productsTable.availableQuantity} <= ${threshold} then 1 end)::int`,
    outOfStockCount: sql<number>`count(case when ${productsTable.availableQuantity} = 0 then 1 end)::int`,
    retailValue: sql<number>`coalesce(sum(${productsTable.availableQuantity} * ${productsTable.price}::numeric), 0)::float`,
    purchaseValue: sql<number>`coalesce(sum(${productsTable.availableQuantity} * coalesce(${productsTable.supplierCost}::numeric, 0)), 0)::float`,
    verifiedPraoCount: sql<number>`count(case when ${productsTable.isVerified} = true then 1 end)::int`,
  }).from(productsTable);

  // 5. Zero Sales Products Count (in last 30 days)
  const [zeroSalesStats] = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM products p
    WHERE p.is_active = true
      AND p.id NOT IN (
        SELECT distinct oi.product_id 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= ${thirtyDaysAgo}
      )
  `).then(res => res.rows);

  const zeroSalesCount = Number((zeroSalesStats as any)?.count || 0);

  // 6. Fast-Selling Products (sold in last 7 days)
  const [fastSellingStats] = await db.execute(sql`
    SELECT count(distinct oi.product_id)::int AS count, coalesce(sum(oi.quantity), 0)::int AS units
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= ${sevenDaysAgo}
  `).then(res => res.rows);

  const fastSellingCount = Number((fastSellingStats as any)?.count || 0);

  // 7. Newly Added Products Count (last 14 days)
  const [newArrivalsStats] = await db.select({
    count: sql<number>`count(*)::int`
  }).from(productsTable).where(and(eq(productsTable.isActive, true), gte(productsTable.createdAt, fourteenDaysAgo)));

  const newArrivalsCount = Number(newArrivalsStats?.count || 0);

  // 8. Construct Smart Business Alerts ("Attention Required")
  const alerts: Array<{
    id: string;
    type: "low-stock" | "out-of-stock" | "pending-payments" | "slow-moving" | "fast-selling" | "new-arrivals";
    title: string;
    description: string;
    actionLabel: string;
    actionTarget: string;
    severity: "warning" | "destructive" | "amber" | "info" | "emerald";
    count: number;
    amount?: number;
  }> = [];

  if (invHealth.lowStockCount > 0) {
    alerts.push({
      id: "low-stock",
      type: "low-stock",
      title: "Low Stock Inventory Alert",
      description: `${invHealth.lowStockCount} jewellery pieces are running low on stock (≤ ${threshold} units remaining). Restock soon to prevent missed sales.`,
      actionLabel: "View Low Stock Products",
      actionTarget: "modal-low-stock",
      severity: "warning",
      count: invHealth.lowStockCount,
    });
  }

  if (invHealth.outOfStockCount > 0) {
    alerts.push({
      id: "out-of-stock",
      type: "out-of-stock",
      title: "Sold Out Products",
      description: `${invHealth.outOfStockCount} products are completely out of stock. Customers cannot purchase these items.`,
      actionLabel: "Restock Now",
      actionTarget: "modal-out-of-stock",
      severity: "destructive",
      count: invHealth.outOfStockCount,
    });
  }

  if (filteredPending > 0) {
    alerts.push({
      id: "pending-payments",
      type: "pending-payments",
      title: "Outstanding Customer Payments",
      description: `${unpaidOrdersCount} customer orders have pending balances totaling ₹${filteredPending.toLocaleString("en-IN")}. Follow up to collect payments.`,
      actionLabel: "View Unpaid Orders",
      actionTarget: "/orders",
      severity: "amber",
      count: unpaidOrdersCount,
      amount: filteredPending,
    });
  }

  if (zeroSalesCount > 0) {
    alerts.push({
      id: "slow-moving",
      type: "slow-moving",
      title: "Slow-Moving Inventory",
      description: `${zeroSalesCount} active jewellery pieces have had zero customer sales in the last 30 days. Consider featuring them or running promotions.`,
      actionLabel: "Review Slow-Moving Items",
      actionTarget: "modal-zero-sales",
      severity: "info",
      count: zeroSalesCount,
    });
  }

  if (fastSellingCount > 0) {
    alerts.push({
      id: "fast-selling",
      type: "fast-selling",
      title: "High Demand Velocity",
      description: `${fastSellingCount} products generated recent customer orders in the last 7 days. Ensure stock availability for high performers.`,
      actionLabel: "View Top Sellers",
      actionTarget: "tab-insights",
      severity: "emerald",
      count: fastSellingCount,
    });
  }

  // Backward-compatible fields
  const [totalUsersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);

  res.json({
    // Backward-compatible top-level keys
    totalProducts: invHealth.totalProducts,
    totalInventory: invHealth.totalStockUnits,
    totalOrders: salesSummary.totalOrders,
    todaySales: salesSummary.todaySales,
    monthlySales: salesSummary.thisMonthSales,
    totalUsers: totalUsersRow.count,
    outOfStockCount: invHealth.outOfStockCount,
    lowStockCount: invHealth.lowStockCount,

    // Comprehensive Structured KPIs
    kpis: {
      sales: {
        todaySales: salesSummary.todaySales,
        yesterdaySales: salesSummary.yesterdaySales,
        thisWeekSales: salesSummary.thisWeekSales,
        thisMonthSales: salesSummary.thisMonthSales,
        lastMonthSales: salesSummary.lastMonthSales,
        thisYearSales: salesSummary.thisYearSales,
        totalSales: salesSummary.totalSales,
        filteredSales,
      },
      payments: {
        amountCollected: filteredPaid,
        pendingPayments: filteredPending,
        cashCollected,
        upiCollected,
        otherCollected,
        allTimeCollected: salesSummary.allTimeCollected,
        allTimePending: salesSummary.allTimePending,
        unpaidOrdersCount,
      },
      profitability: isAdmin ? {
        grossProfit,
        grossProfitMargin,
        totalCogs,
        itemRevenue,
        averageOrderValue: avgOrderValue,
        itemsSold,
        itemsWithMissingCost,
        costCoveragePercent,
      } : null,
      orders: {
        totalOrders: salesSummary.totalOrders,
        todayOrders: salesSummary.todayOrders,
        yesterdayOrders: salesSummary.yesterdayOrders,
        thisMonthOrders: salesSummary.thisMonthOrders,
        filteredOrders,
        averageOrderValue: avgOrderValue,
        avgItemsPerOrder,
      },
    },

    inventory: {
      totalProducts: invHealth.totalProducts,
      activeProducts: invHealth.activeProducts,
      inactiveProducts: invHealth.inactiveProducts,
      totalStockUnits: invHealth.totalStockUnits,
      lowStockCount: invHealth.lowStockCount,
      outOfStockCount: invHealth.outOfStockCount,
      lowStockThreshold: threshold,
      retailValue: isAdmin ? invHealth.retailValue : null,
      purchaseValue: isAdmin ? invHealth.purchaseValue : null,
      verifiedPraoCount: invHealth.verifiedPraoCount,
    },

    alerts,
    auditedAt: new Date().toISOString(),
  });
});

// ============================================================================
// 2. GET /api/dashboard/analytics
// Interactive Time-Series Charts, Sales vs Collections, Categories & Payment Methods
// ============================================================================
router.get("/dashboard/analytics", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { dateFrom, dateTo, trendPeriod: rawPeriod } = req.query;
  const trendPeriod = (typeof rawPeriod === "string" ? rawPeriod.toLowerCase() : "monthly");

  const conditions: ReturnType<typeof sql>[] = [
    sql`o.status NOT IN ('cancelled', 'refunded')`,
  ];
  if (dateFrom && typeof dateFrom === "string" && dateFrom.trim()) {
    const dFrom = new Date(`${dateFrom.trim()}T00:00:00.000Z`);
    if (!isNaN(dFrom.getTime())) conditions.push(sql`o.created_at >= ${dFrom}`);
  }
  if (dateTo && typeof dateTo === "string" && dateTo.trim()) {
    const dTo = new Date(`${dateTo.trim()}T23:59:59.999Z`);
    if (!isNaN(dTo.getTime())) conditions.push(sql`o.created_at <= ${dTo}`);
  }

  const whereSql = conditions.length > 0 ? sql` WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

  // Time-series trend formatting based on period
  let timeFormat = "YYYY-MM";
  let labelFormat = "Mon YYYY";

  if (trendPeriod === "daily") {
    timeFormat = "YYYY-MM-DD";
    labelFormat = "DD Mon";
  } else if (trendPeriod === "weekly") {
    timeFormat = "IYYY-IW";
    labelFormat = '"Wk" IW YYYY';
  } else if (trendPeriod === "yearly") {
    timeFormat = "YYYY";
    labelFormat = "YYYY";
  }

  const trendsRaw = await db.execute(sql`
    SELECT
      to_char(o.created_at, '${sql.raw(timeFormat)}') AS date_key,
      to_char(o.created_at, '${sql.raw(labelFormat)}') AS date_label,
      count(*)::int AS order_count,
      coalesce(sum(o.grand_total::numeric), 0)::float AS revenue,
      coalesce(sum(o.paid_amount::numeric), 0)::float AS paid_amount,
      coalesce(sum(o.pending_amount::numeric), 0)::float AS pending_amount
    FROM orders o
    ${whereSql}
    GROUP BY 1, 2
    ORDER BY date_key ASC
    LIMIT 30
  `);

  // Category Performance Chart
  const categoryRaw = await db.execute(sql`
    SELECT
      coalesce(oi.category, p.category, 'Jewellery') AS category,
      sum(oi.quantity)::int AS "quantitySold",
      coalesce(sum(oi.total::numeric), 0)::float AS revenue,
      count(distinct oi.order_id)::int AS "orderCount"
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    ${whereSql}
    GROUP BY coalesce(oi.category, p.category, 'Jewellery')
    ORDER BY revenue DESC
  `);

  const totalCatRevenue = categoryRaw.rows.reduce((acc, r: any) => acc + Number(r.revenue || 0), 0);
  const categoryPerformance = categoryRaw.rows.map((r: any) => ({
    category: String(r.category),
    quantitySold: Number(r.quantitySold),
    revenue: Number(r.revenue),
    orderCount: Number(r.orderCount),
    percentage: totalCatRevenue > 0 ? Math.round((Number(r.revenue) / totalCatRevenue) * 100) : 0,
  }));

  // Payment Method Distribution Chart
  const paymentRaw = await db.execute(sql`
    SELECT
      coalesce(o.payment_method, 'Cash') AS method,
      coalesce(sum(o.paid_amount::numeric), 0)::float AS amount,
      count(*)::int AS "orderCount"
    FROM orders o
    ${whereSql}
    GROUP BY coalesce(o.payment_method, 'Cash')
    ORDER BY amount DESC
  `);

  const totalPaymentAmount = paymentRaw.rows.reduce((acc, r: any) => acc + Number(r.amount || 0), 0);
  const paymentColors: Record<string, string> = {
    Cash: "#10b981", // Emerald
    UPI: "#6366f1",  // Indigo
    Card: "#f59e0b", // Amber
    Online: "#3b82f6",// Blue
    Other: "#8b5cf6", // Purple
  };

  const paymentDistribution = paymentRaw.rows.map((r: any) => ({
    method: String(r.method),
    amount: Number(r.amount),
    orderCount: Number(r.orderCount),
    percentage: totalPaymentAmount > 0 ? Math.round((Number(r.amount) / totalPaymentAmount) * 100) : 0,
    color: paymentColors[r.method] || "#94a3b8",
  }));

  // Best-Selling Products (Top 8 for Chart)
  const bestSellersRaw = await db.execute(sql`
    WITH product_sales AS (
      SELECT
        oi.product_id,
        sum(oi.quantity)::int AS quantity_sold,
        coalesce(sum(oi.total::numeric), 0)::float AS total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ${whereSql}
      GROUP BY oi.product_id
    )
    SELECT
      ps.*,
      p.name AS "productName",
      p.sku,
      p.category,
      p.images
    FROM product_sales ps
    JOIN products p ON ps.product_id = p.id
    ORDER BY ps.quantity_sold DESC, ps.total_revenue DESC
    LIMIT 8
  `);

  const bestSellers = bestSellersRaw.rows.map((r: any) => ({
    productId: Number(r.product_id),
    productName: String(r.productName),
    sku: String(r.sku || "—"),
    category: String(r.category || "Jewellery"),
    totalQuantitySold: Number(r.quantity_sold),
    totalRevenue: Number(r.total_revenue),
    images: Array.isArray(r.images) ? r.images : [],
  }));

  // Summary Totals
  const summaryRaw = await db.execute(sql`
    SELECT
      count(*)::int AS total_orders,
      coalesce(sum(grand_total::numeric), 0)::float AS total_revenue,
      coalesce(sum(paid_amount::numeric), 0)::float AS total_paid,
      coalesce(sum(pending_amount::numeric), 0)::float AS total_pending
    FROM orders o
    ${whereSql}
  `);

  const sRow = (summaryRaw.rows[0] as Record<string, unknown>) || {};
  const totalRev = Number(sRow.total_revenue || 0);
  const totalPaid = Number(sRow.total_paid || 0);
  const totalPending = Number(sRow.total_pending || 0);

  const salesVsCollections = {
    totalRevenue: totalRev,
    totalPaid,
    totalPending,
    paidPercent: totalRev > 0 ? Math.round((totalPaid / totalRev) * 100) : 0,
    pendingPercent: totalRev > 0 ? Math.round((totalPending / totalRev) * 100) : 0,
  };

  // Backward-compatible monthWise format
  const monthWise = trendsRaw.rows.map((r: any) => ({
    monthKey: String(r.date_key),
    monthLabel: String(r.date_label),
    orderCount: Number(r.order_count),
    revenue: Number(r.revenue),
    paidAmount: Number(r.paid_amount),
    pendingAmount: Number(r.pending_amount),
  }));

  res.json({
    trends: monthWise,
    monthWise, // Backward compatibility
    productWise: bestSellers, // Backward compatibility
    bestSellers,
    salesVsCollections,
    categoryPerformance,
    paymentDistribution,
    summary: {
      totalOrders: Number(sRow.total_orders || 0),
      totalRevenue: totalRev,
      totalPaid,
      totalPending,
    },
    trendPeriod,
  });
});

// ============================================================================
// 3. GET /api/dashboard/product-insights
// Top 10 by Qty, Revenue, Profit, Slow-Moving Zero Sales, & New Arrivals
// ============================================================================
router.get("/dashboard/product-insights", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { dateFrom, dateTo } = req.query;
  const conditions: ReturnType<typeof sql>[] = [
    sql`o.status NOT IN ('cancelled', 'refunded')`,
  ];

  if (dateFrom && typeof dateFrom === "string" && dateFrom.trim()) {
    const dFrom = new Date(`${dateFrom.trim()}T00:00:00.000Z`);
    if (!isNaN(dFrom.getTime())) conditions.push(sql`o.created_at >= ${dFrom}`);
  }
  if (dateTo && typeof dateTo === "string" && dateTo.trim()) {
    const dTo = new Date(`${dateTo.trim()}T23:59:59.999Z`);
    if (!isNaN(dTo.getTime())) conditions.push(sql`o.created_at <= ${dTo}`);
  }

  const whereSql = conditions.length > 0 ? sql` WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

  // Top Products by Units Sold & Revenue
  const topSoldRaw = await db.execute(sql`
    WITH product_sales AS (
      SELECT
        oi.product_id,
        sum(oi.quantity)::int AS quantity_sold,
        coalesce(sum(oi.total::numeric), 0)::float AS revenue,
        coalesce(sum(oi.quantity * coalesce(p.supplier_cost::numeric, 0)), 0)::float AS cogs,
        coalesce(sum(oi.total::numeric - (oi.quantity * coalesce(p.supplier_cost::numeric, 0))), 0)::float AS profit
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      ${whereSql}
      GROUP BY oi.product_id
    )
    SELECT
      ps.*,
      p.name AS "productName",
      p.sku,
      p.supplier_sku AS "supplierSku",
      p.category,
      p.price::float AS price,
      p.available_quantity AS stock,
      p.images
    FROM product_sales ps
    JOIN products p ON ps.product_id = p.id
    ORDER BY ps.quantity_sold DESC, ps.revenue DESC
    LIMIT 10
  `);

  const topByQuantity = topSoldRaw.rows.map((r: any) => ({
    productId: Number(r.product_id),
    productName: String(r.productName),
    sku: String(r.sku || "—"),
    supplierSku: String(r.supplierSku || ""),
    category: String(r.category || "Jewellery"),
    price: Number(r.price),
    stock: Number(r.stock),
    quantitySold: Number(r.quantity_sold),
    revenue: Number(r.revenue),
    cogs: Number(r.cogs),
    profit: Number(r.profit),
    margin: Number(r.revenue) > 0 ? Math.round((Number(r.profit) / Number(r.revenue)) * 100) : 0,
    images: Array.isArray(r.images) ? r.images : [],
  }));

  // Top Products by Revenue
  const topByRevenue = [...topByQuantity].sort((a, b) => b.revenue - a.revenue);

  // Top Products by Profit
  const topByProfit = [...topByQuantity].sort((a, b) => b.profit - a.profit);

  // Slow-Moving Products (Active with zero sales in period, up to 15)
  const slowMovingRaw = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.sku,
      p.supplier_sku AS "supplierSku",
      p.category,
      p.price::float AS price,
      p.available_quantity AS "availableQuantity",
      p.images,
      p.created_at AS "createdAt"
    FROM products p
    WHERE p.is_active = true
      AND p.id NOT IN (
        SELECT distinct oi.product_id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        ${whereSql}
      )
    ORDER BY p.available_quantity DESC, p.id DESC
    LIMIT 15
  `);

  const slowMoving = slowMovingRaw.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    sku: String(r.sku || "—"),
    supplierSku: String(r.supplierSku || ""),
    category: String(r.category || "Jewellery"),
    price: Number(r.price),
    availableQuantity: Number(r.availableQuantity),
    images: Array.isArray(r.images) ? r.images : [],
    createdAt: r.createdAt,
  }));

  // New Catalogue Arrivals (Last 10 added)
  const newArrivals = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      supplierSku: productsTable.supplierSku,
      category: productsTable.category,
      price: productsTable.price,
      availableQuantity: productsTable.availableQuantity,
      images: productsTable.images,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .where(eq(productsTable.isActive, true))
    .orderBy(desc(productsTable.createdAt), desc(productsTable.id))
    .limit(10);

  res.json({
    topByQuantity,
    topByRevenue,
    topByProfit,
    slowMoving,
    newArrivals: newArrivals.map(p => ({
      ...p,
      price: Number(p.price),
      images: Array.isArray(p.images) ? p.images : [],
    })),
  });
});

// ============================================================================
// 4. GET /api/dashboard/inventory-products
// Drill-Down Products List for Low Stock, Out of Stock, or Zero Sales Modals
// ============================================================================
router.get("/dashboard/inventory-products", requireAuth, async (req, res): Promise<void> => {
  const rawStatus = (req.query.status || req.query.filter || "all") as string;
  const threshold = Math.max(1, Number(req.query.threshold) || 2);

  const conditions = [];

  if (rawStatus === "low-stock" || rawStatus === "low_stock") {
    conditions.push(sql`available_quantity > 0 AND available_quantity <= ${threshold}`);
  } else if (rawStatus === "out-of-stock" || rawStatus === "out_of_stock") {
    conditions.push(sql`available_quantity = 0`);
  } else if (rawStatus === "inactive" || rawStatus === "discontinued") {
    conditions.push(eq(productsTable.isActive, false));
  } else if (rawStatus === "active") {
    conditions.push(eq(productsTable.isActive, true));
  } else if (rawStatus === "zero-sales" || rawStatus === "zero_sales") {
    conditions.push(sql`is_active = true AND id NOT IN (SELECT distinct product_id FROM order_items)`);
  } else if (rawStatus === "all") {
    // Return all items ordered by quantity
  } else {
    // Default: low stock + out of stock
    conditions.push(sql`available_quantity <= ${threshold}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const products = await db
    .select()
    .from(productsTable)
    .where(whereClause)
    .orderBy(productsTable.availableQuantity, desc(productsTable.id))
    .limit(100);

  res.json({
    data: products.map(p => ({
      ...p,
      price: Number(p.price),
      compareAtPrice: Number(p.compareAtPrice || 0),
      supplierCost: Number(p.supplierCost || 0),
      images: Array.isArray(p.images) ? p.images : [],
    })),
    total: products.length,
    threshold,
  });
});

// ============================================================================
// 5. GET /api/dashboard/activity
// Unified Chronological Activity Feed (Orders, Stock Adjustments, Payments)
// ============================================================================
router.get("/dashboard/activity", requireAuth, async (_req, res): Promise<void> => {
  // Recent Orders
  const recentOrders = await db
    .select({
      id: ordersTable.id,
      invoiceNumber: ordersTable.invoiceNumber,
      customerName: ordersTable.customerName,
      grandTotal: ordersTable.grandTotal,
      paidAmount: ordersTable.paidAmount,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(15);

  // Recent Stock Movements
  const recentStock = await db
    .select({
      id: inventoryTable.id,
      productId: inventoryTable.productId,
      productName: inventoryTable.productName,
      previousQuantity: inventoryTable.previousQuantity,
      quantityAdded: inventoryTable.quantityAdded,
      quantityReduced: inventoryTable.quantityReduced,
      currentQuantity: inventoryTable.currentQuantity,
      actionType: inventoryTable.actionType,
      updatedAt: inventoryTable.updatedAt,
    })
    .from(inventoryTable)
    .orderBy(desc(inventoryTable.updatedAt))
    .limit(15);

  // Merge & Sort chronologically
  const activities = [
    ...recentOrders.map(o => ({
      id: `order-${o.id}`,
      type: "order" as const,
      title: `Order ${o.invoiceNumber}`,
      subtitle: `Customer: ${o.customerName}`,
      amount: Number(o.grandTotal),
      paidAmount: Number(o.paidAmount),
      status: o.status,
      method: o.paymentMethod,
      timestamp: o.createdAt,
      link: `/orders/${o.id}`,
    })),
    ...recentStock.map(s => {
      const isAdd = s.actionType === "add" || (s.quantityAdded ?? 0) > 0;
      const change = (s.quantityAdded ?? 0) > 0 ? `+${s.quantityAdded}` : `-${s.quantityReduced ?? 0}`;
      return {
        id: `stock-${s.id}`,
        type: "stock" as const,
        title: `${s.actionType === "add" ? "Stock Added" : s.actionType === "reduce" ? "Stock Reduced" : "Stock Adjusted"}: ${s.productName}`,
        subtitle: `Balance: ${s.currentQuantity} units (previously ${s.previousQuantity})`,
        qtyChange: change,
        status: s.actionType,
        timestamp: s.updatedAt,
        link: `/products`,
      };
    }),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  res.json({ activities });
});

// ============================================================================
// 6. GET /api/dashboard/recent-orders (Backward Compatibility)
// ============================================================================
router.get("/dashboard/recent-orders", requireAuth, async (_req, res): Promise<void> => {
  const orders = await db
    .select({
      id: ordersTable.id,
      invoiceNumber: ordersTable.invoiceNumber,
      customerName: ordersTable.customerName,
      customerMobile: ordersTable.customerMobile,
      customerEmail: ordersTable.customerEmail,
      customerAddress: ordersTable.customerAddress,
      subtotal: ordersTable.subtotal,
      gstPercentage: ordersTable.gstPercentage,
      gstAmount: ordersTable.gstAmount,
      referralCharges: ordersTable.referralCharges,
      discount: ordersTable.discount,
      grandTotal: ordersTable.grandTotal,
      paidAmount: ordersTable.paidAmount,
      pendingAmount: ordersTable.pendingAmount,
      status: ordersTable.status,
      createdById: ordersTable.createdById,
      createdByName: usersTable.name,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, sql`${ordersTable.createdById} = ${usersTable.id}`)
    .orderBy(desc(ordersTable.createdAt))
    .limit(10);

  res.json(orders.map(o => ({
    ...o,
    subtotal: Number(o.subtotal),
    gstPercentage: Number(o.gstPercentage),
    gstAmount: Number(o.gstAmount),
    referralCharges: Number(o.referralCharges),
    discount: Number(o.discount),
    grandTotal: Number(o.grandTotal),
    paidAmount: Number(o.paidAmount),
    pendingAmount: Number(o.pendingAmount),
  })));
});

// ============================================================================
// 7. GET /api/dashboard/low-stock (Backward Compatibility)
// ============================================================================
router.get("/dashboard/low-stock", requireAuth, async (req, res): Promise<void> => {
  const threshold = Number(req.query.threshold) || 2;
  const products = await db
    .select()
    .from(productsTable)
    .where(lte(productsTable.availableQuantity, threshold))
    .orderBy(productsTable.availableQuantity)
    .limit(20);

  res.json(products.map(p => ({
    ...p,
    price: Number(p.price),
    images: Array.isArray(p.images) ? p.images : [],
  })));
});

// ============================================================================
// 8. GET /api/dashboard/user (Cashier / Staff Dashboard Overview)
// ============================================================================
router.get("/dashboard/user", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [ordersToday] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(
    and(sql`created_by_id = ${user.id}`, gte(ordersTable.createdAt, todayStart))
  );
  const [totalOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(sql`created_by_id = ${user.id}`);
  const [totalRevenue] = await db.select({ sum: sql<number>`coalesce(sum(grand_total::numeric), 0)::float` }).from(ordersTable).where(sql`created_by_id = ${user.id}`);

  res.json({
    ordersToday: ordersToday.count,
    totalOrders: totalOrders.count,
    totalRevenue: totalRevenue.sum,
  });
});

// ============================================================================
// 9. EXPORTS (Master Excel Backup, Orders CSV, Inventory CSV)
// ============================================================================
router.get("/dashboard/export/excel", requireAuth, async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const products = await db.select().from(productsTable).orderBy(productsTable.name);
  const inventoryLogs = await db.select().from(inventoryTable).orderBy(desc(inventoryTable.updatedAt));

  const monthWiseRaw = await db.execute(sql`
    SELECT
      to_char(o.created_at, 'Mon YYYY') AS month_label,
      count(*)::int AS order_count,
      coalesce(sum(o.grand_total::numeric), 0)::float AS revenue,
      coalesce(sum(o.paid_amount::numeric), 0)::float AS paid_amount,
      coalesce(sum(o.pending_amount::numeric), 0)::float AS pending_amount
    FROM orders o
    GROUP BY to_char(o.created_at, 'YYYY-MM'), to_char(o.created_at, 'Mon YYYY')
    ORDER BY to_char(o.created_at, 'YYYY-MM') DESC
  `);

  const lines: string[] = [];
  lines.push("\uFEFFSAJIRI JEWELS - MASTER BUSINESS & INVENTORY BACKUP");
  lines.push(`Generated On: "${new Date().toLocaleString("en-IN")}"`);
  lines.push("");

  // SECTION 1: MONTHLY SALES SUMMARY
  lines.push("--- MONTHLY SALES & REVENUE SUMMARY ---");
  lines.push(["Month", "Total Orders", "Total Revenue (₹)", "Total Paid (₹)", "Pending Balance (₹)"].map(escapeCsv).join(","));
  for (const m of monthWiseRaw.rows as any[]) {
    lines.push([
      m.month_label,
      m.order_count,
      Number(m.revenue).toFixed(2),
      Number(m.paid_amount).toFixed(2),
      Number(m.pending_amount).toFixed(2),
    ].map(escapeCsv).join(","));
  }
  lines.push("");

  // SECTION 2: ALL ORDERS
  lines.push("--- ALL ORDERS & INVOICES ---");
  lines.push([
    "Invoice No", "Date", "Customer Name", "Customer Mobile", "Customer Email",
    "Customer Address", "Payment Method", "Subtotal (₹)", "GST (%)", "GST Amount (₹)",
    "Discount (₹)", "Referral Charges (₹)", "Grand Total (₹)", "Paid Amount (₹)",
    "Pending Balance (₹)", "Status"
  ].map(escapeCsv).join(","));

  for (const o of orders) {
    lines.push([
      o.invoiceNumber,
      new Date(o.createdAt).toLocaleString("en-IN"),
      o.customerName,
      o.customerMobile,
      o.customerEmail || "",
      o.customerAddress || "",
      o.paymentMethod || "Cash",
      Number(o.subtotal).toFixed(2),
      Number(o.gstPercentage),
      Number(o.gstAmount).toFixed(2),
      Number(o.discount).toFixed(2),
      Number(o.referralCharges).toFixed(2),
      Number(o.grandTotal).toFixed(2),
      Number(o.paidAmount).toFixed(2),
      Number(o.pendingAmount).toFixed(2),
      o.status,
    ].map(escapeCsv).join(","));
  }
  lines.push("");

  // SECTION 3: PRODUCTS & INVENTORY DATA
  lines.push("--- PRODUCTS & STOCK INVENTORY DATA ---");
  lines.push([
    "Product ID", "Product Name", "SKU", "Category", "Unit Price (₹)", "Supplier Cost (₹)", "Available Stock",
    "Total Stock Retail Value (₹)", "Stock Status"
  ].map(escapeCsv).join(","));

  for (const p of products) {
    const qty = p.availableQuantity;
    const price = Number(p.price);
    const stockValue = qty * price;
    const stockStatus = qty === 0 ? "Out of Stock" : qty <= 2 ? "Low Stock" : "In Stock";

    lines.push([
      p.id,
      p.name,
      p.sku || "",
      p.category || "",
      price.toFixed(2),
      Number(p.supplierCost || 0).toFixed(2),
      qty,
      stockValue.toFixed(2),
      stockStatus,
    ].map(escapeCsv).join(","));
  }
  lines.push("");

  // SECTION 4: INVENTORY TRANSACTIONS / AUDIT LOGS
  lines.push("--- INVENTORY MOVEMENT LOGS ---");
  lines.push([
    "Log ID", "Product Name", "Previous Qty", "Quantity Added", "Quantity Reduced",
    "Current Qty", "Action Type", "Timestamp"
  ].map(escapeCsv).join(","));

  for (const l of inventoryLogs) {
    lines.push([
      l.id,
      l.productName,
      l.previousQuantity,
      l.quantityAdded || 0,
      l.quantityReduced || 0,
      l.currentQuantity,
      l.actionType,
      new Date(l.updatedAt).toLocaleString("en-IN"),
    ].map(escapeCsv).join(","));
  }

  const csvContent = lines.join("\n");
  const filename = `Sajiri_Jewels_Master_Backup_${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvContent);
});

router.get("/dashboard/export/orders", requireAuth, async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const lines: string[] = [];

  lines.push("\uFEFFInvoice No,Date,Customer Name,Customer Mobile,Customer Email,Customer Address,Payment Method,Subtotal (₹),GST (%),GST Amount (₹),Discount (₹),Referral Charges (₹),Grand Total (₹),Paid Amount (₹),Pending Balance (₹),Status");

  for (const o of orders) {
    lines.push([
      o.invoiceNumber,
      new Date(o.createdAt).toLocaleString("en-IN"),
      o.customerName,
      o.customerMobile,
      o.customerEmail || "",
      o.customerAddress || "",
      o.paymentMethod || "Cash",
      Number(o.subtotal).toFixed(2),
      Number(o.gstPercentage),
      Number(o.gstAmount).toFixed(2),
      Number(o.discount).toFixed(2),
      Number(o.referralCharges).toFixed(2),
      Number(o.grandTotal).toFixed(2),
      Number(o.paidAmount).toFixed(2),
      Number(o.pendingAmount).toFixed(2),
      o.status,
    ].map(escapeCsv).join(","));
  }

  const filename = `Sajiri_Orders_${new Date().toISOString().split("T")[0]}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(lines.join("\n"));
});

router.get("/dashboard/export/inventory", requireAuth, async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(productsTable.name);
  const lines: string[] = [];

  lines.push("\uFEFFProduct ID,Product Name,SKU,Category,Unit Price (₹),Supplier Cost (₹),Available Stock,Total Stock Value (₹),Stock Status");

  for (const p of products) {
    const qty = p.availableQuantity;
    const price = Number(p.price);
    const stockValue = qty * price;
    const stockStatus = qty === 0 ? "Out of Stock" : qty <= 2 ? "Low Stock" : "In Stock";

    lines.push([
      p.id,
      p.name,
      p.sku || "",
      p.category || "",
      price.toFixed(2),
      Number(p.supplierCost || 0).toFixed(2),
      qty,
      stockValue.toFixed(2),
      stockStatus,
    ].map(escapeCsv).join(","));
  }

  const filename = `Sajiri_Products_Inventory_${new Date().toISOString().split("T")[0]}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(lines.join("\n"));
});

export default router;
