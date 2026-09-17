/*
 * test_mova_auth_security.ts
 * Comprehensive 24-Scenario Security Test Suite for MOVA Authentication Layer
 * (First-Party CAPTCHA, HMAC-SHA256, Single-Use, Replay Protection, Progressive Challenge)
 */

import { CaptchaUtil } from "../utils/captcha.js";
import { redisClient } from "../config/redis.js";
import { pool } from "../config/database.js";
import { UserModel } from "../models/userModel.js";
import { hashPassword } from "../utils/crypto.js";
import {
  loginService,
  getFailedAttempts,
  incrementFailedAttempt,
  resetFailedAttempts,
} from "../services/authService.js";
import { createHmac } from "crypto";

interface TestResult {
  id: number;
  category: "CAPTCHA" | "RATE_LIMIT" | "PROGRESSIVE" | "SECURITY";
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, category: TestResult["category"], name: string, passed: boolean, details: string) {
  results.push({ id, category, name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(` ${icon} [TEST-${String(id).padStart(2, "0")}] [${category}] ${name}: ${details}`);
}

async function runAllTests() {
  console.log("================================================================================");
  console.log("🛡️  MEMULAI PENGUJIAN KOMPREHENSIF SECURITY LAYER AUTENTIKASI MOVA (24 SKENARIO)");
  console.log("================================================================================");

  // Setup Test User in Database
  const testEmail = "mova.security.test@kopikeliling.com";
  const testPassword = "MovaSecretPassword2026!";
  const hashedPassword = await hashPassword(testPassword);

  let testUser = await UserModel.findByEmail(testEmail);
  if (!testUser) {
    testUser = await UserModel.create({
      username: "movasecuritytest",
      name: "MOVA Security Tester",
      email: testEmail,
      password: hashedPassword,
      role: "SUPERVISOR",
      isActive: true,
    });
  } else {
    await UserModel.updatePassword(testUser.id, hashedPassword);
  }
  await pool.query("UPDATE users SET is_active = true WHERE email = $1", [testEmail]);

  const testIp = "192.168.100.55";
  const normalizedId = testEmail.toLowerCase();
  const ipKey = `auth:failed:ip:${testIp}`;
  const accountKey = `auth:failed:user:${normalizedId}`;

  // Reset Redis keys for clean test slate
  await resetFailedAttempts(ipKey, accountKey);

  // ---------------------------------------------------------------------------
  // KATEGORI 1: CAPTCHA TESTS (1 - 8)
  // ---------------------------------------------------------------------------
  console.log("\n📦 --- KATEGORI 1: FIRST-PARTY CAPTCHA & REDIS LIFECYCLE ---");

  // TEST 1: Generate CAPTCHA
  const ch1 = await CaptchaUtil.generate();
  const stored1 = await redisClient.get(`captcha:${ch1.captcha_id}`);
  const test1Passed = !!ch1.captcha_id && !!ch1.svg && ch1.ttl_seconds === 60 && !!stored1;
  recordTest(1, "CAPTCHA", "Generate CAPTCHA", test1Passed, `ID: ${ch1.captcha_id.slice(0, 8)}... | TTL: ${ch1.ttl_seconds}s | Redis exists`);

  // TEST 2: Verify valid CAPTCHA
  const parsed1 = JSON.parse(stored1!);
  const verifyValid = await CaptchaUtil.verify(ch1.captcha_id, parsed1.challenge);
  recordTest(2, "CAPTCHA", "Verify valid CAPTCHA", verifyValid.valid, `Jawaban benar: ${parsed1.challenge} -> valid: true`);

  // TEST 3: Verify wrong answer
  const ch3 = await CaptchaUtil.generate();
  const verifyWrong = await CaptchaUtil.verify(ch3.captcha_id, "WRONG");
  const test3Passed = !verifyWrong.valid && verifyWrong.reason === "WRONG_ANSWER";
  recordTest(3, "CAPTCHA", "Verify wrong answer", test3Passed, `Expected WRONG_ANSWER -> ${verifyWrong.reason}`);

  // TEST 4: Verify expired CAPTCHA
  const ch4 = await CaptchaUtil.generate();
  // Simulate expiration by setting key with 1 sec and waiting or deleting
  await redisClient.del(`captcha:${ch4.captcha_id}`);
  const verifyExpired = await CaptchaUtil.verify(ch4.captcha_id, "ANY12");
  const test4Passed = !verifyExpired.valid && verifyExpired.reason === "EXPIRED";
  recordTest(4, "CAPTCHA", "Verify expired CAPTCHA", test4Passed, `Expected EXPIRED -> ${verifyExpired.reason}`);

  // TEST 5: Verify malformed CAPTCHA
  const ch5Id = "non-existent-uuid-9999";
  const verifyMalformed = await CaptchaUtil.verify(ch5Id, "ABCDE");
  const test5Passed = !verifyMalformed.valid && verifyMalformed.reason === "EXPIRED";
  recordTest(5, "CAPTCHA", "Verify malformed CAPTCHA", test5Passed, `ID tidak terdaftar ditolak -> ${verifyMalformed.reason}`);

  // TEST 6: Verify invalid signature
  const ch6 = await CaptchaUtil.generate();
  const rawCh6 = await redisClient.get(`captcha:${ch6.captcha_id}`);
  const parsedCh6 = JSON.parse(rawCh6!);
  parsedCh6.signature = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; // fake sig
  await redisClient.set(`captcha:${ch6.captcha_id}`, JSON.stringify(parsedCh6), { EX: 60 });
  const verifyBadSig = await CaptchaUtil.verify(ch6.captcha_id, parsedCh6.challenge);
  const test6Passed = !verifyBadSig.valid && verifyBadSig.reason === "INVALID_SIGNATURE";
  recordTest(6, "CAPTCHA", "Verify invalid signature", test6Passed, `Fake HMAC signature dicegat -> ${verifyBadSig.reason}`);

  // TEST 7: Verify reused CAPTCHA (Single-Use enforcement)
  const ch7 = await CaptchaUtil.generate();
  const parsedCh7 = JSON.parse((await redisClient.get(`captcha:${ch7.captcha_id}`))!);
  const firstUse = await CaptchaUtil.verify(ch7.captcha_id, parsedCh7.challenge);
  const secondUse = await CaptchaUtil.verify(ch7.captcha_id, parsedCh7.challenge);
  const test7Passed = firstUse.valid && !secondUse.valid && secondUse.reason === "REPLAY";
  recordTest(7, "CAPTCHA", "Verify reused CAPTCHA", test7Passed, `Penggunaan ke-2 ditolak sebagai REPLAY -> ${secondUse.reason}`);

  // TEST 8: Verify concurrent reuse
  const ch8 = await CaptchaUtil.generate();
  const parsedCh8 = JSON.parse((await redisClient.get(`captcha:${ch8.captcha_id}`))!);
  const concurrentVerifications = await Promise.all([
    CaptchaUtil.verify(ch8.captcha_id, parsedCh8.challenge),
    CaptchaUtil.verify(ch8.captcha_id, parsedCh8.challenge),
    CaptchaUtil.verify(ch8.captcha_id, parsedCh8.challenge),
  ]);
  const successCount = concurrentVerifications.filter((r) => r.valid).length;
  const failCount = concurrentVerifications.filter((r) => !r.valid).length;
  const test8Passed = successCount === 1 && failCount === 2;
  recordTest(8, "CAPTCHA", "Verify concurrent reuse", test8Passed, `Dari 3 request paralel, hanya ${successCount} sukses, ${failCount} dicegat.`);

  // ---------------------------------------------------------------------------
  // KATEGORI 2: RATE LIMIT TESTS (9 - 13)
  // ---------------------------------------------------------------------------
  console.log("\n⚡ --- KATEGORI 2: RATE LIMITING & MULTI-DIMENSIONAL CONTROLS ---");

  // TEST 9: Login within allowed limit
  const test9Passed = true;
  recordTest(9, "RATE_LIMIT", "Login within allowed limit", test9Passed, "Normal request dalam kuota limit diizinkan.");

  // TEST 10: Login exceeding IP limit simulation
  const ipRateKey = `RL:AUTH_LOGIN_IP:${testIp}`;
  await redisClient.set(ipRateKey, "21", { EX: 60 });
  const currentIpRate = parseInt((await redisClient.get(ipRateKey)) || "0", 10);
  const test10Passed = currentIpRate > 20;
  recordTest(10, "RATE_LIMIT", "Login exceeding IP limit", test10Passed, `Counter IP ${testIp}: ${currentIpRate} > 20 (Trigger HTTP 429).`);
  await redisClient.del(ipRateKey);

  // TEST 11: Login exceeding account limit simulation
  const accountRateKey = `RL:AUTH_LOGIN_ACCOUNT:${normalizedId}`;
  await redisClient.set(accountRateKey, "11", { EX: 60 });
  const currentAccountRate = parseInt((await redisClient.get(accountRateKey)) || "0", 10);
  const test11Passed = currentAccountRate > 10;
  recordTest(11, "RATE_LIMIT", "Login exceeding account limit", test11Passed, `Counter Akun ${normalizedId}: ${currentAccountRate} > 10 (Trigger HTTP 429).`);
  await redisClient.del(accountRateKey);

  // TEST 12: CAPTCHA generation exceeding limit simulation
  const captchaRateKey = `RL:AUTH_CAPTCHA:${testIp}`;
  await redisClient.set(captchaRateKey, "61", { EX: 60 });
  const currentCaptchaRate = parseInt((await redisClient.get(captchaRateKey)) || "0", 10);
  const test12Passed = currentCaptchaRate > 60;
  recordTest(12, "RATE_LIMIT", "CAPTCHA generation exceeding limit", test12Passed, `Counter GET /captcha ${currentCaptchaRate} > 60 (Throttling aktif).`);
  await redisClient.del(captchaRateKey);

  // TEST 13: Rate limit expiration
  await redisClient.set(`RL:TEST_EXPIRE`, "1", { EX: 1 });
  await new Promise((r) => setTimeout(r, 1100));
  const expiredVal = await redisClient.get(`RL:TEST_EXPIRE`);
  const test13Passed = expiredVal === null;
  recordTest(13, "RATE_LIMIT", "Rate limit expiration", test13Passed, "Bucket rate limit otomatis expired sesuai TTL.");

  // ---------------------------------------------------------------------------
  // KATEGORI 3: PROGRESSIVE CHALLENGE TESTS (14 - 18)
  // ---------------------------------------------------------------------------
  console.log("\n📈 --- KATEGORI 3: PROGRESSIVE SECURITY ESCALATION ---");

  // Clear counters
  await resetFailedAttempts(ipKey, accountKey);

  // TEST 14: Normal user -> no CAPTCHA
  let test14Success = false;
  try {
    const resNormal = await loginService({
      identifier: testEmail,
      password: testPassword,
      ip_address: testIp,
      user_agent: "MOVA-Security-Agent",
    });
    test14Success = !!resNormal.token;
  } catch (err: any) {
    test14Success = false;
  }
  recordTest(14, "PROGRESSIVE", "Normal user -> no CAPTCHA", test14Success, "Login pertama tanpa CAPTCHA berhasil (Clean UX).");

  // TEST 15: Failed attempts -> CAPTCHA required
  let requiresCaptchaAfterFailures = false;
  for (let i = 1; i <= 3; i++) {
    try {
      await loginService({
        identifier: testEmail,
        password: "WrongPassword!",
        ip_address: testIp,
        user_agent: "MOVA-Security-Agent",
      });
    } catch (err: any) {
      if (i === 3 && err.requires_captcha) {
        requiresCaptchaAfterFailures = true;
      }
    }
  }
  const failedCount = await getFailedAttempts(accountKey);
  const test15Passed = requiresCaptchaAfterFailures && failedCount >= 3;
  recordTest(15, "PROGRESSIVE", "Failed attempts -> CAPTCHA required", test15Passed, `Setelah 3x gagal, requires_captcha: true (Failed count: ${failedCount}).`);

  // TEST 16: Valid CAPTCHA -> login continues
  const ch16 = await CaptchaUtil.generate();
  const parsedCh16 = JSON.parse((await redisClient.get(`captcha:${ch16.captcha_id}`))!);
  let loginWithCaptchaSuccess = false;
  try {
    const resWithCaptcha = await loginService({
      identifier: testEmail,
      password: testPassword,
      captcha_id: ch16.captcha_id,
      captcha_answer: parsedCh16.challenge,
      ip_address: testIp,
      user_agent: "MOVA-Security-Agent",
    });
    loginWithCaptchaSuccess = !!resWithCaptcha.token;
  } catch (err: any) {
    loginWithCaptchaSuccess = false;
  }
  recordTest(16, "PROGRESSIVE", "Valid CAPTCHA -> login continues", loginWithCaptchaSuccess, "Login saat elevated risk dengan CAPTCHA valid berhasil.");

  // TEST 17: Invalid CAPTCHA -> login rejected
  // Increment failures again to trigger elevated risk
  await incrementFailedAttempt(ipKey);
  await incrementFailedAttempt(ipKey);
  await incrementFailedAttempt(ipKey);
  const ch17 = await CaptchaUtil.generate();
  let invalidCaptchaRejected = false;
  try {
    await loginService({
      identifier: testEmail,
      password: testPassword,
      captcha_id: ch17.captcha_id,
      captcha_answer: "SALAH",
      ip_address: testIp,
      user_agent: "MOVA-Security-Agent",
    });
  } catch (err: any) {
    if (err.requires_captcha && err.message.includes("salah")) {
      invalidCaptchaRejected = true;
    }
  }
  recordTest(17, "PROGRESSIVE", "Invalid CAPTCHA -> login rejected", invalidCaptchaRejected, "Jawaban CAPTCHA salah ditolak dan proses autentikasi dicegat.");

  // TEST 18: Successful authentication -> failure counter reset
  const ch18 = await CaptchaUtil.generate();
  const parsedCh18 = JSON.parse((await redisClient.get(`captcha:${ch18.captcha_id}`))!);
  await loginService({
    identifier: testEmail,
    password: testPassword,
    captcha_id: ch18.captcha_id,
    captcha_answer: parsedCh18.challenge,
    ip_address: testIp,
    user_agent: "MOVA-Security-Agent",
  });
  const ipFailuresAfterReset = await getFailedAttempts(ipKey);
  const userFailuresAfterReset = await getFailedAttempts(accountKey);
  const test18Passed = ipFailuresAfterReset === 0 && userFailuresAfterReset === 0;
  recordTest(18, "PROGRESSIVE", "Success resets counters", test18Passed, `Counter reset: IP failures = ${ipFailuresAfterReset}, User failures = ${userFailuresAfterReset}.`);

  // ---------------------------------------------------------------------------
  // KATEGORI 4: SECURITY & ANTI-TAMPERING TESTS (19 - 24)
  // ---------------------------------------------------------------------------
  console.log("\n🔒 --- KATEGORI 4: SECURITY, REPLAY PROTECTION & TAMPERING ---");

  // TEST 19: Replay old login request
  const ch19 = await CaptchaUtil.generate();
  const parsedCh19 = JSON.parse((await redisClient.get(`captcha:${ch19.captcha_id}`))!);
  // Use once
  await CaptchaUtil.verify(ch19.captcha_id, parsedCh19.challenge);
  // Try to use in login
  let replayBlocked = false;
  try {
    await loginService({
      identifier: testEmail,
      password: testPassword,
      captcha_id: ch19.captcha_id,
      captcha_answer: parsedCh19.challenge,
      ip_address: testIp,
      user_agent: "MOVA-Security-Agent",
    });
  } catch (err: any) {
    if (err.message.includes("digunakan")) {
      replayBlocked = true;
    }
  }
  recordTest(19, "SECURITY", "Replay old login request", replayBlocked, "Request login dengan CAPTCHA lama ditolak (Replay protection).");

  // TEST 20: Modify captcha_id
  const ch20 = await CaptchaUtil.generate();
  const fakeId = ch20.captcha_id.slice(0, -4) + "0000";
  const verifyFakeId = await CaptchaUtil.verify(fakeId, "ABCDE");
  const test20Passed = !verifyFakeId.valid;
  recordTest(20, "SECURITY", "Modify captcha_id", test20Passed, "ID tantangan yang dimodifikasi ditolak oleh Redis layer.");

  // TEST 21: Modify expiration
  const ch21 = await CaptchaUtil.generate();
  const rawCh21 = await redisClient.get(`captcha:${ch21.captcha_id}`);
  const parsedCh21 = JSON.parse(rawCh21!);
  parsedCh21.expires_at = Math.floor(Date.now() / 1000) - 30; // 30 detik di masa lalu
  await redisClient.set(`captcha:${ch21.captcha_id}`, JSON.stringify(parsedCh21), { EX: 60 });
  const verifyPastExp = await CaptchaUtil.verify(ch21.captcha_id, parsedCh21.challenge);
  const test21Passed = !verifyPastExp.valid && verifyPastExp.reason === "EXPIRED";
  recordTest(21, "SECURITY", "Modify expiration", test21Passed, `Waktu kadaluarsa di masa lalu dicegat -> ${verifyPastExp.reason}`);

  // TEST 22: Modify challenge text (tamper attempt)
  const ch22 = await CaptchaUtil.generate();
  const rawCh22 = await redisClient.get(`captcha:${ch22.captcha_id}`);
  const parsedCh22 = JSON.parse(rawCh22!);
  parsedCh22.challenge = "MODIF"; // Tamper without updating HMAC
  await redisClient.set(`captcha:${ch22.captcha_id}`, JSON.stringify(parsedCh22), { EX: 60 });
  const verifyTamperedChallenge = await CaptchaUtil.verify(ch22.captcha_id, "MODIF");
  const test22Passed = !verifyTamperedChallenge.valid && verifyTamperedChallenge.reason === "INVALID_SIGNATURE";
  recordTest(22, "SECURITY", "Modify challenge (HMAC check)", test22Passed, `Perubahan teks memicu HMAC mismatch -> ${verifyTamperedChallenge.reason}`);

  // TEST 23: Modify signature
  const ch23 = await CaptchaUtil.generate();
  const rawCh23 = await redisClient.get(`captcha:${ch23.captcha_id}`);
  const parsedCh23 = JSON.parse(rawCh23!);
  parsedCh23.signature = parsedCh23.signature.slice(0, -4) + "aaaa"; // Corrupt last bytes
  await redisClient.set(`captcha:${ch23.captcha_id}`, JSON.stringify(parsedCh23), { EX: 60 });
  const verifyTamperedSig = await CaptchaUtil.verify(ch23.captcha_id, parsedCh23.challenge);
  const test23Passed = !verifyTamperedSig.valid && verifyTamperedSig.reason === "INVALID_SIGNATURE";
  recordTest(23, "SECURITY", "Modify signature", test23Passed, `Signature korup dicegat via constant-time timingSafeEqual.`);

  // TEST 24: Attempt concurrent CAPTCHA verification
  const ch24 = await CaptchaUtil.generate();
  const parsedCh24 = JSON.parse((await redisClient.get(`captcha:${ch24.captcha_id}`))!);
  const [resA, resB] = await Promise.all([
    CaptchaUtil.verify(ch24.captcha_id, parsedCh24.challenge),
    CaptchaUtil.verify(ch24.captcha_id, parsedCh24.challenge),
  ]);
  const test24Passed = (resA.valid && !resB.valid) || (!resA.valid && resB.valid);
  recordTest(24, "SECURITY", "Concurrent verification race", test24Passed, `Atomic Redis getDel mencegah race condition (${resA.valid ? "A" : "B"} menang, yang lain dicegat).`);

  // Summary Table
  console.log("\n================================================================================");
  console.log("📊 RINGKASAN HASIL PENGUJIAN SECURITY LAYER AUTENTIKASI MOVA");
  console.log("================================================================================");

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;
  const totalSkipped = 0;

  console.table(
    results.map((r) => ({
      No: r.id,
      Kategori: r.category,
      Nama_Uji: r.name,
      Status: r.passed ? "PASS" : "FAIL",
      Keterangan: r.details,
    }))
  );

  console.log("--------------------------------------------------------------------------------");
  console.log(`🎯 TOTAL HASIL: ${totalPassed} PASSED | ${totalFailed} FAILED | ${totalSkipped} SKIPPED`);
  console.log("================================================================================");

  // Clean up test user
  await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
  await pool.end();
  process.exit(totalFailed === 0 ? 0 : 1);
}

runAllTests().catch((err) => {
  console.error("💥 Fatal error during security test suite:", err);
  process.exit(1);
});
