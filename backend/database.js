const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let pool;

/**
 * Executes a write query (INSERT, UPDATE, DELETE)
 */
const dbRun = async (sql, params = []) => {
  if (!pool) throw new Error("Database connection pool not initialized.");
  const [result] = await pool.execute(sql, params);
  return { 
    id: result.insertId || null, 
    changes: result.affectedRows || 0 
  };
};

/**
 * Executes a query that returns a single row
 */
const dbGet = async (sql, params = []) => {
  if (!pool) throw new Error("Database connection pool not initialized.");
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Executes a query that returns all rows
 */
const dbAll = async (sql, params = []) => {
  if (!pool) throw new Error("Database connection pool not initialized.");
  const [rows] = await pool.execute(sql, params);
  return rows;
};

// Initialize database schema and handle safe seeding
async function initDb() {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,   
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });

  // Surface pool-level errors immediately
  pool.on('error', (err) => {
    console.error('  ⚠ Unexpected MySQL Pool Error:', err.code || err.message);
  });

  // Verify connection availability right away
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('  ✓ MySQL connection verified');
  } catch (err) {
    console.error('  ✗ MySQL connection verification failed:', err.code || err.message);
    console.error('  → Connection Check:', { host: process.env.DB_HOST, user: process.env.DB_USER, db: process.env.DB_NAME });
    throw new Error(`Database connection failed: ${err.message}`);
  }

  try {
    // 1. Users Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        verified TINYINT(1) DEFAULT 0,
        telegram_username VARCHAR(100),
        bio TEXT,
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // 2. Listings Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS listings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        broker_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        type VARCHAR(20) NOT NULL,
        price DOUBLE NOT NULL,
        currency VARCHAR(10) DEFAULT 'ETB',
        location VARCHAR(255) NOT NULL,
        images TEXT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // 3. Reviews Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        broker_id INT NOT NULL,
        client_id INT NOT NULL,
        rating INT NOT NULL,
        comment VARCHAR(1000) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_broker_client (broker_id, client_id)
      ) ENGINE=InnoDB
    `);

    // 4. Verification Requests
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS verification_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        id_type VARCHAR(50) NOT NULL,
        id_number VARCHAR(100) NOT NULL,
        document_path VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // 5. Security Logs
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        user_id INT,
        ip_address VARCHAR(45),
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // Handle data seeding safety check
    const [rows] = await connection.execute("SELECT COUNT(*) as count FROM users");
    const userCount = rows[0]?.count || 0;

    if (userCount === 0) {
      console.log("  → Seeding initial data (first run)...");

      const adminHash = await bcrypt.hash("AdminPassword123!", 10);
      const broker1Hash = await bcrypt.hash("BrokerAbeba123!", 10);
      const broker2Hash = await bcrypt.hash("BrokerKebede123!", 10);
      const clientHash = await bcrypt.hash("ClientAbenezer123!", 10);

      // Seed Users
      const [adminRes] = await connection.execute(`
        INSERT INTO users (email, password_hash, full_name, phone, role, verified, bio, avatar)
        VALUES (?, ?, ?, ?, 'admin', 1, 'System Administrator for CMC Delal', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')
      `, ['admin@cmcdelal.com', adminHash, 'Assefa Demeke', '+251911000000']);

      const [b1Res] = await connection.execute(`
        INSERT INTO users (email, password_hash, full_name, phone, role, verified, telegram_username, bio, avatar)
        VALUES (?, ?, ?, ?, 'broker', 1, 'abeba_delal', 'Professional Real Estate Broker in Addis Ababa with 5+ years of experience.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150')
      `, ['abeba@cmcdelal.com', broker1Hash, 'Abeba Kiros', '+251911223344']);

      const [b2Res] = await connection.execute(`
        INSERT INTO users (email, password_hash, full_name, phone, role, verified, telegram_username, bio, avatar)
        VALUES (?, ?, ?, ?, 'broker', 0, 'kebede_cars', 'Car sales and rental specialist operating around Megenagna.', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150')
      `, ['kebede@cmcdelal.com', broker2Hash, 'Kebede Abebe', '+251911556677']);

      const [cRes] = await connection.execute(`
        INSERT INTO users (email, password_hash, full_name, phone, role, verified, bio, avatar)
        VALUES (?, ?, ?, ?, 'client', 0, 'Addis Ababa local looking for housing options.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150')
      `, ['abenezer@gmail.com', clientHash, 'Abenezer Yosef', '+251922334455']);

      const b1Id = b1Res.insertId;
      const b2Id = b2Res.insertId;
      const cId = cRes.insertId;

      if (b1Id && b2Id && cId) {
        // Seed Listings
        await connection.execute(`
          INSERT INTO listings (broker_id, title, description, category, type, price, currency, location, images)
          VALUES (?, ?, ?, 'real_estate', 'rent', 45000, 'ETB', 'Bole Atlas', ?)
        `, [
          b1Id,
          'Modern 2-Bedroom Apartment in Bole Atlas',
          'Beautiful fully-furnished apartment. 2 bedrooms, 2 bathrooms, high-speed WiFi, backup generator, secure compound, and excellent view of the city.',
          JSON.stringify(['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'])
        ]);

        await connection.execute(`
          INSERT INTO listings (broker_id, title, description, category, type, price, currency, location, images)
          VALUES (?, ?, ?, 'real_estate', 'sale', 12500000, 'ETB', 'Yeka (Megenagna)', ?)
        `, [
          b1Id,
          'Spacious Townhouse for Sale in Yeka',
          'Luxury townhouse with 4 bedrooms, service quarters, spacious modern kitchen, and parking space for 3 cars.',
          JSON.stringify(['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'])
        ]);

        await connection.execute(`
          INSERT INTO listings (broker_id, title, description, category, type, price, currency, location, images)
          VALUES (?, ?, ?, 'vehicle', 'sale', 3200000, 'ETB', 'Kirkos (Bole Road)', ?)
        `, [
          b2Id,
          'Toyota Vitz 2018 - Excellent Condition',
          'Engine size 1.0L, automatic transmission, fuel efficient, original left hand drive, low mileage (45,000 km).',
          JSON.stringify(['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800'])
        ]);

        // Seed Review
        await connection.execute(`
          INSERT INTO reviews (broker_id, client_id, rating, comment)
          VALUES (?, ?, 5, 'Abeba was extremely professional and helped me secure my apartment in Bole Atlas within 3 days. Highly recommended!')
        `, [b1Id, cId]);

        console.log("  → Seeded initial database tables cleanly.");
      } else {
        console.warn("  ⚠ Seeding skipped: Relational reference user IDs could not be resolved.");
      }
    }
  } catch (schemaError) {
    console.error(" ✗ Schema compilation or seeding crash encountered:", schemaError.message);
    throw schemaError;
  } finally {
    // Ensure connection is ALWAYS freed back to the pool pool
    if (connection) connection.release();
  }
}

/**
 * Clears all tables and re-seeds the database safely.
 */
async function resetDb() {
  console.log("Resetting database...");
  if (!pool) throw new Error("Database connection pool not initialized.");
  
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  await pool.query("TRUNCATE TABLE reviews");
  await pool.query("TRUNCATE TABLE listings");
  await pool.query("TRUNCATE TABLE verification_requests");
  await pool.query("TRUNCATE TABLE security_logs");
  await pool.query("TRUNCATE TABLE users");
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  
  console.log("Database cleared. Re-seeding...");
  await initDb();
}

const getPool = () => pool;

module.exports = {
  dbRun,
  dbGet,
  dbAll,
  initDb,
  resetDb,
  getPool
};