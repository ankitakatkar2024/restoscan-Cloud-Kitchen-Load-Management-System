# RestoScan – Real-Time Cloud Kitchen Load Management System

RestoScan is a **real-time restaurant ordering and kitchen workflow management system** designed to digitize the dining experience and streamline communication between customers, kitchen staff, and administrators.

The platform enables customers to **scan a QR code at their table, browse a digital menu, place orders directly to the kitchen, track preparation status in real time, and complete digital payments**, all without requiring a mobile application.

RestoScan improves restaurant efficiency by **reducing manual errors, optimizing kitchen workflows, and providing real-time operational visibility**.

---

# Live Demo

🌐 **Website:**
`https://restoscan-cloud-kitchen-load-management-h021.onrender.com/menu`

---

# Key Features

### QR-Based Table Ordering

Customers scan a table-specific QR code to access the digital menu and start a dining session.

### Real-Time Order Processing

Orders are instantly transmitted to the kitchen using **WebSocket communication**, allowing chefs to receive tickets immediately.

### Chef Console (Kitchen Display System)

Kitchen staff can view incoming orders, update preparation status, and manage cooking workflows efficiently.

### Live Order Tracking

Customers can track order progress in real time through status updates such as:

Pending → Preparing → Ready

### Station Load Management

Redis-based monitoring prevents kitchen overload by tracking the workload of different kitchen stations.

### Role-Based Dashboards

The system provides dedicated interfaces for:

* Customers (Menu & Order Tracking)
* Chefs (Order Console)
* Administrators (Management Dashboard)

### Digital Payment Integration

Customers can generate a **UPI QR code** to complete payment, while administrators verify transactions.

---

# System Workflow

1. Customer scans the **table QR code**
2. Digital menu opens in the browser
3. Customer selects items and places order
4. Order is sent to the **Chef Console in real time**
5. Chef updates order status
6. Customer tracks preparation progress
7. Customer completes payment
8. Admin verifies payment and clears the table session

---

# Technology Stack

## Frontend

* React.js
* Tailwind CSS
* Axios

## Backend

* Node.js

## Database

* MongoDB

## Real-Time Communication

* Socket.io (WebSockets)

## Caching & Load Management

* Redis

## Deployment

* Render (Backend)
* Cloud hosting for frontend

---

# Architecture Overview

RestoScan follows a **real-time event-driven architecture**.

Customer Browser
⬇
React Frontend
⬇
Node.js 
⬇
MongoDB (Data Storage)
⬇
Redis (Load Monitoring)
⬇
Socket.io (Real-Time Communication)
⬇
Chef Console / Admin Dashboard

---

# Advantages

* Eliminates manual order-taking errors
* Faster communication between kitchen and customers
* Real-time operational visibility
* Reduced staff workload
* Contactless dining experience
* Scalable cloud-based architecture

---

# Future Enhancements

The system can be extended with:

* AI-based demand prediction
* Inventory management integration
* Advanced analytics dashboard
* Customer loyalty programs
* Mobile application version
* Voice-based ordering

---



# Project Status

✅ **Completed and Deployed**

The system is fully functional and live with real-time ordering, kitchen workflow management, and digital payment support.

---

# Author

**Ankita**

