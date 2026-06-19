const assert = require('assert');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// Import helpers directly for unit testing
const { 
  sanitizeText, 
  validateAndNormalizePhone, 
  validateEmail 
} = require('./security');

console.log("=================================================");
console.log("   ሲኤምሲ ደላላ (CMC Delal) Security Test Suite");
console.log("=================================================");

// --- 1. Unit Tests ---
function runUnitTests() {
  console.log("\n[1/2] Running Unit Tests...");

  // A. Input Sanitization (XSS Mitigation)
  const maliciousInput = "<script>alert('XSS')</script> & <img src=x onerror=abc()>";
  const sanitized = sanitizeText(maliciousInput);
  assert.ok(!sanitized.includes("<script>"), "Failed XSS Mitigation: script tag not escaped");
  assert.ok(!sanitized.includes("<img"), "Failed XSS Mitigation: img tag not escaped");
  assert.ok(sanitized.includes("&lt;script&gt;"), "Failed XSS Mitigation: '<' not converted");
  assert.ok(sanitized.includes("&amp;"), "Failed XSS Mitigation: '&' not converted");
  console.log("  ✓ Input sanitization escaped XSS payloads correctly.");

  // B. Ethiopian Phone Validation & Normalization
  assert.strictEqual(validateAndNormalizePhone("0911223344"), "+251911223344", "Failed normalization of local 09...");
  assert.strictEqual(validateAndNormalizePhone("0711223344"), "+251711223344", "Failed normalization of local 07...");
  assert.strictEqual(validateAndNormalizePhone("+251911223344"), "+251911223344", "Failed normalization of international +251...");
  assert.strictEqual(validateAndNormalizePhone("251911223344"), "+251911223344", "Failed normalization of international 251...");
  assert.strictEqual(validateAndNormalizePhone("911223344"), "+251911223344", "Failed normalization of simple 9...");
  assert.strictEqual(validateAndNormalizePhone("0811223344"), null, "Incorrectly approved invalid prefix (08...)");
  assert.strictEqual(validateAndNormalizePhone("abc1234567"), null, "Incorrectly approved alphabetic phone input");
  console.log("  ✓ Ethiopian phone numbers validated and normalized correctly.");

  // C. Email Format Validation
  assert.ok(validateEmail("test@gmail.com"), "Valid email failed check"); 
  assert.ok(validateEmail("broker.almaz@cmcdelal.et"), "Valid domain extension email failed check");
  assert.ok(!validateEmail("invalid-email"), "Invalid email passed check");
  assert.ok(!validateEmail("test@domain"), "Missing TLD email passed check");
  console.log("  ✓ Email format validations asserted correctly.");
}

// --- 2. Integration Tests (E2E API validation) ---
async function runIntegrationTests() {
  console.log("\n[2/2] Running Integration & Authorization Tests...");
  
  // Start server on port 3001 to prevent conflicts
  const env = { ...process.env, PORT: '3001' };
  const serverProcess = spawn('node', [path.join(__dirname, 'server.js')], { env });
  
  // Wait for server to spin up
  await new Promise((resolve) => {
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes("Backend is running")) {
        resolve();
      }
    });
  });

  console.log("  ✓ Server spawned successfully on port 3001.");

  // Helper function to query local server
  const fetchUrl = (path, method = 'GET', body = null) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: JSON.parse(responseData)
            });
          } catch {
            resolve({ statusCode: res.statusCode, body: responseData });
          }
        });
      });
      
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  try {
    // Test A: Unauthorized access to Admin verification requests should return 401
    const adminCheck = await fetchUrl('/api/admin/verifications');
    assert.strictEqual(adminCheck.statusCode, 401, "Admin verification API allowed anonymous access!");
    assert.ok(adminCheck.body.error.includes("Authentication token missing"), "Incorrect error description for missing token");
    console.log("  ✓ Anonymous request to admin dashboard blocked with 401.");

    // Test B: Unauthorized access to Listings creation should return 401
    const listingCheck = await fetchUrl('/api/listings', 'POST', { title: 'Ghost Villa' });
    assert.strictEqual(listingCheck.statusCode, 401, "Listings CRUD allowed unauthorized POST requests!");
    console.log("  ✓ Anonymous request to create listing blocked with 401.");

    // Test C: Prevent Role Escalation during registration
    const registerAdmin = await fetchUrl('/api/auth/register', 'POST', {
      email: 'fakeadmin@cmcdelal.com',
      password: 'StrongPassword123!',
      full_name: 'Fake Admin',
      phone: '0912345678',
      role: 'admin' // Attempt role injection
    });
    assert.strictEqual(registerAdmin.statusCode, 400, "Register API allowed role escalation to admin!");
    assert.ok(registerAdmin.body.error.includes('Role must be either "client" or "broker"'), "Role escalation did not trigger correct error message");
    console.log("  ✓ Client role escalation registration request blocked with 400.");

    // Test D: Brute Force Prevention & Login Safety (Generic Error messages)
    const badLogin = await fetchUrl('/api/auth/login', 'POST', {
      email: 'nonexistent@cmcdelal.com',
      password: 'WrongPassword123'
    });
    assert.strictEqual(badLogin.statusCode, 400, "Wrong login request didn't return 400");
    assert.strictEqual(badLogin.body.error, "Invalid email or password.", "Login failed error leaks email details (enables enumeration)");
    console.log("  ✓ Failed login requests return secure, generic error messages.");

  } finally {
    // Kill server process cleanly
    serverProcess.kill();
    console.log("  ✓ Server process terminated cleanly.");
  }
}

// --- Bootstrap ---
async function run() {
  try {
    runUnitTests();
    await runIntegrationTests();
    console.log("\n=================================================");
    console.log("   SUCCESS: All security assertions passed!");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("\n=================================================");
    console.error("   FAILURE: Test assertion failed!");
    console.error(err);
    console.log("=================================================");
    process.exit(1);
  }
}

run();
