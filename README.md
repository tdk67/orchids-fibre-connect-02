# B2B Fiber Connect - All-in-One Sales CRM

A comprehensive CRM and sales platform designed for selling fiber optic internet connections to small businesses (B2B). This application streamlines the entire sales process, from lead identification and cold calling to contract closing and commission management.

## 🚀 Overview

The **FibreConnect CRM** is built to support high-performance sales teams. It provides tools for sales agents to manage their pipeline, for team leads to monitor performance, and for administrators to configure products and commission rules.

### Core Business Logic
- **B2B Focus:** Targeted specifically at small business fiber installations.
- **Sales Flow:** Supports the journey from initial Lead -> Opportunity (Verkaufschance) -> Sale (Verkauf).
- **Partner System:** Supports both internal employees and external partners with role-based access.
- **Commission Engine:** Automated calculation of commissions based on flexible rules and products.

---

## 📱 Key Features & Screens

### 1. Dashboard
- **Overview:** Real-time stats on leads, sales, revenue, and commissions.
- **Today's Agenda:** Integrated calendar showing appointments for the day.
- **Performance Tracking:** Visual monthly targets and achievement levels.
- **Quick Actions:** One-click buttons to add leads or capture sales.

### 2. Lead Management
- **Lead Pool:** A centralized repository of unassigned leads that agents can claim.
- **Lead Details:** Deep dive into company information, contact history, and activity logs.
- **Status Pipeline:** Track leads through custom statuses (New, Contacted, Interested, etc.).
- **Automatic Assignment:** Intelligent routing of leads to available agents.

### 3. Sales & Opportunities
- **Verkaufschancen:** Track potential deals in the pipeline with expected values and closing dates.
- **Sales Recording:** Capture closed contracts with customer details, product type (Telekom, etc.), and contract value.
- **Document Management:** Upload and manage contract-related files.

### 4. Employee & Partner Management
- **Role-based Access:** (Admin, Teamleiter, Mitarbeiter).
- **Team Management:** Team leaders can monitor their assigned agents' activity and performance.
- **Partner Portal:** Limited views for external partners to manage their own specific lead sets.

### 5. Commissions & Billing
- **Provisionsregeln:** Configure complex commission rules per product and agent type.
- **Commissions Overview:** Real-time calculation of earned commissions for current and past months.
- **Credit Notes (Gutschriften):** Generate and track payouts to agents and partners.

---

## 🛠️ Technical Setup

### Prerequisites
- Node.js (v18+)
- Supabase Account
- PostgreSQL Database

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd all-in-one-solutions
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Copy the example environment file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   *Required Keys:*
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Public API Key.
   - `DATABASE_CONNECTION_STRING`: Your Postgres connection URI.

4. **Database Schema:**
   The project includes SQL migration files in the root directory:
   - `database_schema.sql`: Core tables and structures.
   - `database_schema_extension.sql`: Additional features and fields.
   Apply these to your Supabase/Postgres instance.

### Running Locally
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

---

## ☁️ Deployment

### Vercel (Recommended)
1. Push your code to GitHub/GitLab.
2. Connect your repository to Vercel.
3. Add the Environment Variables from your `.env` file to the Vercel project settings.
4. **IMPORTANT:** Ensure `VITE_SUPABASE_URL` uses `https://` in production.

---

## 🔒 Security Best Practices

### `.env` and Git
**NEVER commit your `.env` file to version control.** If you accidentally committed it, run the following commands immediately to remove it from the history and ignore it:

```bash
# Remove from git index but keep locally
git rm --cached .env

# Add to .gitignore if not already present
echo ".env" >> .gitignore

# Commit the change
git commit -m "chore: remove sensitive .env from version control"
```

### Password Encryption
This application uses **HTTPS (TLS)** for all authentication requests. When communicating with the backend, your browser automatically encrypts the payload (including passwords) before it leaves your device. Ensure your backend endpoint always uses `https://` in production environments.

---

## 📄 License
Internal proprietary software for FibreConnect Partners.
