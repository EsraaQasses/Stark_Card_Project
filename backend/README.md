# Stark Backend

Stark is a payment platform backend built with **Django + Django REST Framework (DRF)**, supporting:

- User roles: Admin, Agent, Normal User
- Multi-currency wallets (USD, Lira)
- Deposits, transfers, and product purchases
- Products, sections, payment methods (manual codes, in-game top-up, API provider)
- Agent management with commissions
- Admin dashboard APIs for React frontend

---

## 🔹 Features

1. **User Management**
   - Registration, login (JWT)
   - Roles: Admin, Agent, User
   - Agent-user relationships

2. **Wallets**
   - Multi-currency support (USD, Lira)
   - Balance tracking per user and currency

3. **Transactions**
   - Deposit, purchase, transfer
   - Admin/Agent approval flow
   - Linked to wallets

4. **Store**
   - Sections & Products
   - Multi-currency product prices
   - Payment methods: manual code, API provider, in-game top-up
   - Redeem codes management

5. **Agents**
   - Track linked users
   - Commission calculation
   - Earnings tracking

6. **Admin Dashboard APIs**
   - Manage users, wallets, transactions, sections, products, payment methods
   - Only accessible by Admin role

---

## 🔹 Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/stark-backend.git
cd stark-backend
