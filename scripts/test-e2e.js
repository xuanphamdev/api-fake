import { PrismaClient } from '@prisma/client';
import dns from 'dns';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || 'default-encryption-salt-key-32-b').padEnd(32, 'a').substring(0, 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Ensure dns resolves localhost to 127.0.0.1 (not ipv6 ::1 if Caddy only listens on ipv4)
dns.setDefaultResultOrder('ipv4first');

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING E2E INTEGRATION TESTS ---');

  let testUser;
  let testProject;

  try {
    // 1. Database Seeding
    console.log('[1/5] Seeding test database records...');
    
    // Clean old test runs if crashed
    await prisma.user.deleteMany({ where: { email: 'test-e2e@example.com' } });

    testUser = await prisma.user.create({
      data: {
        email: 'test-e2e@example.com',
        password: 'dummy-hashed-password',
      },
    });

    testProject = await prisma.project.create({
      data: {
        name: 'E2E Test Project',
        slug: 'e2e-test',
        userId: testUser.id,
        corsOrigins: 'https://example-test.com',
        corsHeaders: 'X-Custom-Req',
        corsMethods: 'GET,POST',
        enforceApiKey: false, // will enable later in test
      },
    });

    // Create env secrets
    await prisma.projectSecret.create({
      data: {
        key: 'API_SALT',
        encryptedValue: encrypt('12345'),
        projectId: testProject.id,
      },
    });

    // Create API keys
    await prisma.apiKey.create({
      data: {
        key: 'agy_live_test_api_key_123',
        name: 'Test Key',
        projectId: testProject.id,
      },
    });

    const epStatic = await prisma.endpoint.create({
      data: {
        projectId: testProject.id,
        path: '/v1/users',
        method: 'GET',
        headers: { 'X-Test-Type': 'static-response' },
        statusCode: 200,
        responseBody: JSON.stringify({ users: [{ id: 1, name: 'Alice' }] }),
        delay: 0,
      },
    });

    const epSecrets = await prisma.endpoint.create({
      data: {
        projectId: testProject.id,
        path: '/v1/secrets-test',
        method: 'GET',
        statusCode: 200,
        script: `
          res.send({ val: req.env.API_SALT });
        `,
        delay: 0,
      },
    });

    const epJwt = await prisma.endpoint.create({
      data: {
        projectId: testProject.id,
        path: '/v1/jwt-test',
        method: 'GET',
        statusCode: 200,
        script: `
          const token = res.jwt.sign({ sub: "john_doe" }, "jwt-secret-key");
          const verified = res.jwt.verify(token, "jwt-secret-key");
          res.send({ token, verified });
        `,
        delay: 0,
      },
    });

    const epCompute = await prisma.endpoint.create({
      data: {
        projectId: testProject.id,
        path: '/v1/compute',
        method: 'POST',
        headers: { 'X-Test-Type': 'dynamic-response' },
        statusCode: 200,
        script: `
          if (req.body && req.body.x === 1) {
            res.status(200).send({ result: "matched-one" });
          } else {
            res.status(400).send({ result: "other-value" });
          }
        `,
        delay: 0,
      },
    });

    const epTimeout = await prisma.endpoint.create({
      data: {
        projectId: testProject.id,
        path: '/timeout',
        method: 'GET',
        statusCode: 200,
        script: `
          while(true) {}
        `,
      },
    });

    const epDelay = await prisma.endpoint.create({
      data: {
        projectId: testProject.id,
        path: '/delay',
        method: 'GET',
        statusCode: 204,
        delay: 150,
      },
    });

    console.log(`Seeded user: ${testUser.email}, project: ${testProject.slug}`);

    // 2. Test CORS configuration
    console.log('[2/5] Testing custom CORS configuration headers...');
    const corsRes = await fetch('http://localhost/mock/e2e-test/v1/users', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example-test.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-Custom-Req',
      },
    });
    console.log(`CORS Preflight status: ${corsRes.status}`);
    console.log(`Access-Control-Allow-Origin: ${corsRes.headers.get('access-control-allow-origin')}`);
    console.log(`Access-Control-Allow-Headers: ${corsRes.headers.get('access-control-allow-headers')}`);
    console.log(`Access-Control-Allow-Methods: ${corsRes.headers.get('access-control-allow-methods')}`);

    if (corsRes.headers.get('access-control-allow-origin') !== 'https://example-test.com') {
      throw new Error('CORS Origin mismatch');
    }
    if (corsRes.headers.get('access-control-allow-headers') !== 'X-Custom-Req') {
      throw new Error('CORS Headers mismatch');
    }
    if (!corsRes.headers.get('access-control-allow-methods')?.includes('GET')) {
      throw new Error('CORS Methods mismatch');
    }

    // 3. Test Static and Dynamic Endpoint matching
    console.log('[3/5] Testing static endpoint matching via Caddy proxy...');
    const staticRes = await fetch('http://localhost/mock/e2e-test/v1/users');
    const staticBody = await staticRes.json();
    console.log(`Static response status: ${staticRes.status}`);
    console.log(`Static response header X-Test-Type: ${staticRes.headers.get('x-test-type')}`);
    console.log('Static response body:', staticBody);

    if (staticRes.status !== 200) throw new Error('Static endpoint status failed');
    if (staticBody.users[0].name !== 'Alice') throw new Error('Static body mismatch');

    // 4. Test Dynamic Secrets & JWT sandboxing
    console.log('[4/5] Testing environment secrets injection and JWT signature helpers...');
    
    // A. Secrets Injection Test
    const secretsRes = await fetch('http://localhost/mock/e2e-test/v1/secrets-test');
    const secretsBody = await secretsRes.json();
    console.log('Secrets response body:', secretsBody);
    if (secretsRes.status !== 200 || secretsBody.val !== '12345') {
      throw new Error('Environment secrets injection failed');
    }

    // B. JWT helpers verification
    const jwtRes = await fetch('http://localhost/mock/e2e-test/v1/jwt-test');
    const jwtBody = await jwtRes.json();
    console.log('JWT response body token snippet:', jwtBody.token.substring(0, 40) + '...');
    console.log('JWT response body verified payload:', jwtBody.verified);
    if (jwtRes.status !== 200 || !jwtBody.token || jwtBody.verified.sub !== 'john_doe') {
      throw new Error('QuickJS JWT signature helpers failed');
    }

    // C. Sandbox Compute tests
    const dynResA = await fetch('http://localhost/mock/e2e-test/v1/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 1 }),
    });
    const dynBodyA = await dynResA.json();
    console.log(`Dynamic A status: ${dynResA.status}, body:`, dynBodyA);
    if (dynResA.status !== 200 || dynBodyA.result !== 'matched-one') {
      throw new Error('Dynamic sandbox case A failed');
    }

    // D. Timeout protection (infinite loop script)
    console.log('Testing infinite loop script execution (should fail gracefully within 100ms)...');
    const loopStart = Date.now();
    const loopRes = await fetch('http://localhost/mock/e2e-test/timeout');
    const loopDuration = Date.now() - loopStart;
    console.log(`Loop execution stopped with status: ${loopRes.status} in ${loopDuration}ms`);
    if (loopRes.status !== 500) {
      throw new Error('Loop script did not return HTTP 500 error');
    }

    // E. Latency Delay Simulator
    console.log('Testing request delay simulator (configured for 150ms)...');
    const delayStart = Date.now();
    const delayRes = await fetch('http://localhost/mock/e2e-test/delay');
    const delayDuration = Date.now() - delayStart;
    console.log(`Delayed request completed with status: ${delayRes.status} in ${delayDuration}ms`);
    if (delayDuration < 150) {
      throw new Error(`Delay simulator failed, completed in only ${delayDuration}ms`);
    }

    // 5. Test API Key Gating Auth rules
    console.log('[5/5] Testing Mock API Key authentication protection gate...');
    
    // A. Enable API Key Auth in DB
    await prisma.project.update({
      where: { id: testProject.id },
      data: { enforceApiKey: true },
    });

    // B. Request without authorization header (Should fail with 401)
    const unauthorizedRes = await fetch('http://localhost/mock/e2e-test/v1/users');
    console.log(`Unauthorized request status: ${unauthorizedRes.status}`);
    if (unauthorizedRes.status !== 401) {
      throw new Error('API Gate failed: allowed request without API Key');
    }

    // C. Request with valid bearer authorization header (Should succeed with 200)
    const authorizedRes = await fetch('http://localhost/mock/e2e-test/v1/users', {
      headers: { 'Authorization': 'Bearer agy_live_test_api_key_123' },
    });
    console.log(`Authorized request status: ${authorizedRes.status}`);
    if (authorizedRes.status !== 200) {
      throw new Error('API Gate failed: rejected valid API Key');
    }

    console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ---');

  } catch (error) {
    console.error('--- INTEGRATION TEST FAILED ---');
    console.error(error);
    process.exitCode = 1;
  } finally {
    // Database Cleanup
    console.log('Cleaning up test database records...');
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
    await prisma.$disconnect();
    console.log('Database connection disconnected.');
  }
}

runTests();
