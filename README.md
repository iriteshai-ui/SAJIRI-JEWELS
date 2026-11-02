# 💎 SAJIRI JEWELS — Modern Fashion Jewellery Inventory & Catalogue Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ecf8e.svg)](https://supabase.com/)

**SAJIRI JEWELS** is an end-to-end Luxury Fashion Jewellery Inventory Management & Customer Catalogue Platform. It empowers jewellery businesses to manage private product inventories, import and scrub supplier collections, log real-time stock movements with audit trails, generate BIS-hallmark ready PDF invoices with 3% jewellery GST, and showcase collections through a responsive public customer catalogue.

---

## 🌟 Key Features

### 1. 🛍️ Luxury Customer Catalogue
- **Curated Collections**: Browse anti-tarnish, waterproof, and hypoallergenic fashion jewellery across Necklaces, Bangles, Bracelets, Earrings, and Rings.
- **Instant Search & Filters**: Search by item name, material finish (Gold Plated, Silver, Rose Gold), or category, with in-stock filters.
- **Product Details & Inquiries**: High-resolution image galleries, price comparisons, anti-tarnish warranty specs, and direct WhatsApp inquiry integration.
- **Smart 100-Record Pagination**: Smooth-scrolling pagination with custom page sizes (25, 50, 100, 200 items per page).

### 2. 📊 Real-Time Management Dashboard
- **100% Live DB Analytics**: Zero mock data. Live computation of total inventory valuation, daily sales, active orders, and monthly revenue.
- **Visual Sales Trends**: Interactive charts showing 7-day revenue performance.
- **Low Stock Guard**: Real-time alerts highlighting products with fewer than 10 units in stock.
- **Recent Order Stream**: Instant visibility into order fulfillment status, payment progress, and customer details.

### 3. 📦 Product Inventory & Supplier Importer Studio
- **Supplier Importer Studio**: Batch-fetch supplier collections with one-click import into your private Supabase database.
- **Automatic Brand Scrubbing**: Replaces third-party supplier branding (e.g. PRAO) with **SAJRI** across all titles, descriptions, and SKUs.
- **Rich Fashion Jewellery Attributes**: Tracks metal type, plating, gross/net weight, stone weight, HUID hallmark numbers, and HSN codes (7113).

### 4. 📝 Real-Time Inventory Audit Logging
- **Automated Audit Trail**: Automatically logs an immutable transaction record whenever stock is added, reduced, manually adjusted, or sold via an order.
- **Product Edit Auditing**: Updates on `/products` automatically log previous quantity, change amount, and current quantity with admin user attribution.
- **Detailed History Table**: Color-coded badges for *Stock Added*, *Stock Reduced*, *Order Fulfilled*, *Product Updated*, and *Supplier Import*.

### 5. 🧾 Orders, Billing & PDF Tax Invoices
- **Jewellery GST Compliance**: Applies standard Indian **3% Jewellery GST** (1.5% CGST + 1.5% SGST) dynamically.
- **Smart Item Selector**: Live autocomplete searching with real-time stock deduction protection.
- **Split & Partial Payments**: Tracks cash, UPI, and bank transfers with outstanding balance monitoring.
- **Vector PDF Invoice Generation**: Generates clean, print-ready tax invoices formatted specifically for fashion jewellery (without cluttered static terms).

---

## 🏛️ Monorepo Architecture

The project is structured as a **PNPM Workspace Monorepo**:

```
├── artifacts/
│   ├── api-server/         # Express 5 REST API Backend (TypeScript, ESBuild)
│   └── billing-app/        # Vite 7 + React 19 Frontend SPA (Tailwind CSS, Radix UI)
├── lib/
│   ├── api-client-react/   # Type-safe Axios + React Query hooks generated from OpenAPI
│   ├── api-spec/           # OpenAPI 3.1.0 Contract Specification (openapi.yaml)
│   ├── api-zod/            # Shared Zod validation schemas across frontend & backend
│   └── db/                 # Drizzle ORM schemas, Supabase PostgreSQL pool, and seeders
├── supabase/
│   └── migrations/         # Supabase PostgreSQL SQL migration scripts
├── TASK_LIST.md            # Chronological record of completed features and bug fixes
└── README.md               # Project documentation
```

---

## 🗄️ Database Schema

Managed via **Drizzle ORM** on **Supabase PostgreSQL**:

| Table | Description |
|---|---|
| `users` | Staff & administrator accounts with bcrypt password hashes and RBAC (`admin`, `user`). |
| `categories` | Jewellery classification tree (Necklaces, Earrings, Bangles, Bracelets, Rings). |
| `products` | 580+ private inventory records with pricing, weights, hallmark UIDs, and anti-tarnish specs. |
| `inventory_transactions` | Audit log tracking every stock change (`add`, `reduce`, `update`, `order`, `import`). |
| `orders` | Sales orders tracking subtotal, 3% GST, discount, net amount, paid amount, and status. |
| `order_items` | Line items linked to orders and products with historical unit prices and quantities. |
| `order_payments` | Granular payment transactions tracking payment mode (Cash, UPI) and reference IDs. |
| `session` | PostgreSQL-backed session store for secure authentication cookies. |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **PNPM**: `pnpm` (`corepack enable` or `npm install -g pnpm`)
- **Supabase Account**: A Supabase PostgreSQL database URL

### 1. Clone the Repository
```bash
git clone https://github.com/iriteshai-ui/SAJIRI-JEWELS.git
cd SAJIRI-JEWELS
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
PORT=8080
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres
SESSION_SECRET=sajiri-jewels-secure-secret-key-2026
NODE_ENV=development
```

### 4. Run Migrations & Build
```bash
# Push database migrations to Supabase
pnpm --filter @workspace/db run push

# Build all workspace packages
pnpm run build
```

### 5. Start the Application
Run both backend API and frontend dev servers concurrently:
```bash
# In terminal 1 (API Server on port 8080)
pnpm --filter @workspace/api-server run start

# In terminal 2 (Vite Client on port 5173)
pnpm --filter @workspace/billing-app run dev
```

---

## 🔐 Default Access Credentials

| Role | Username | Password | Access Level |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full access: Catalogue, Importer, Inventory, Products, Users, Settings |
| **Sales Staff** | `user` | `user123` | Billing, Order Creation, Customer Invoices, Catalogue |

---

## 🌐 Application URLs

| Interface | URL | Purpose |
|---|---|---|
| **Public Customer Catalogue** | [http://localhost:5173/catalogue](http://localhost:5173/catalogue) | Customer product browsing & inquiries |
| **Management Portal Login** | [http://localhost:5173/login](http://localhost:5173/login) | Staff & Administrator sign-in |
| **Dashboard** | [http://localhost:5173/dashboard](http://localhost:5173/dashboard) | Live revenue, orders, stock alerts |
| **Jewellery Inventory** | [http://localhost:5173/products](http://localhost:5173/products) | 100-record paginated product management |
| **Inventory Audit Log** | [http://localhost:5173/inventory](http://localhost:5173/inventory) | Real-time stock audit trail |
| **Product Importer Studio** | [http://localhost:5173/importer](http://localhost:5173/importer) | Supplier collection import |
| **Orders & Invoices** | [http://localhost:5173/orders](http://localhost:5173/orders) | GST Billing & PDF invoice downloads |
| **API Server** | [http://localhost:8080/api](http://localhost:8080/api) | Express REST endpoints |

---

## 📄 License
MIT License © 2026 SAJIRI JEWELS. All rights reserved.
