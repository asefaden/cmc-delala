# ሲኤምሲ ደላላ (CMC Delal) - Secure Broker Platform

CMC Delal is a full-stack web application designed to be a modern, secure, and reliable marketplace for Ethiopia. It connects clients with verified brokers (Delalas) for real estate, vehicles, and professional services, aiming to replace the informal and often insecure brokerage market with a transparent, review-based system.

The backend is built with Node.js and Express, featuring a secure JWT authentication system, role-based access control, and a comprehensive API. The frontend is a vanilla JavaScript Single-Page Application (SPA) that is lightweight, fast, and bilingual (English & Amharic).

## ✨ Features

- **Bilingual Interface:** Fully localized in English and Amharic (አማርኛ).
- **Secure Authentication:** JWT-based authentication with `httpOnly` cookies.
- **Role-Based Access:** Clear separation of permissions for Clients, Brokers, and Admins.
- **Advanced Marketplace:** Filter and search listings by category, type, location, price, and keywords.
- **Broker Directory:** A public list of all registered brokers with average ratings and active listing counts.
- **Review System:** Clients can rate and review brokers they have worked with.
- **Broker Verification:** A system for brokers to submit documents and for admins to approve them, granting a "Verified" badge.
- **Admin Dashboard:** A comprehensive panel for user management, verification approvals, and viewing security audit logs.
- **Security First:** Includes rate limiting, XSS protection, and a detailed security logging system.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Authentication:** JSON Web Tokens (JWT), bcryptjs
- **Frontend:** Vanilla JavaScript (SPA), HTML5, CSS3
- **Security:** Helmet, express-rate-limit, CORS
- **File Uploads:** Multer

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- **Node.js:** Version 18.x or higher.
- **MySQL:** A running MySQL server instance.

### Local Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd delal-app
    ```

2.  **Install backend dependencies:**
    ```bash
    npm install
    ```

3.  **Set up the database:**
    - Log in to your MySQL server.
    - Create a new database for the project.
      ```sql
      CREATE DATABASE cmc_delal;
      ```

4.  **Configure environment variables:**
    - Create a `.env` file in the root of the project.
    - Copy the contents of `.env.example` (if available) or use the template below and fill in your details.

    ```env
    # Server Configuration
    PORT=3000
    FRONTEND_URL=http://localhost:5173
    JWT_SECRET=a-very-strong-and-long-secret-key-for-development

    # Database Configuration
    DB_HOST=localhost
    DB_USER=your_mysql_username
    DB_PASSWORD=your_mysql_password
    DB_NAME=cmc_delal
    DB_PORT=3306
    ```

5.  **Run the application:**
    - The `dev` script uses `node --watch` for automatic server restarts on file changes.
    - The first time you run the server, it will automatically create all necessary tables and seed the database with default admin, broker, and client accounts.
    ```bash
    npm run dev
    ```

The backend server will now be running on `http://localhost:3000`.