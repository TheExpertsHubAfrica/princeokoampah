const SPREADSHEET_ID = "1n0jmtZ5HYEVhCJVsK031D0hEVGixFWIP13F4nDqQeBE";
const ADMIN_EMAILS = ["deforexsp@gmail.com", "mrgyan@veritrack.cloud"];
const ADMIN_TOKEN = "msmadmin2026secure";
const PAYSTACK_SECRET_KEY = "sk_test_753edc";
const BASE_DOMAIN = "https://princeokoampah.com/msm";
const SHEETS = { REG: "Registrations", AMB: "Ambassadors", CLICKS: "Clicks" };
const SHEET_HEADERS = {};
SHEET_HEADERS[SHEETS.REG] = ["Timestamp", "Full Name", "Email", "Phone", "Company", "Role", "Ticket Type", "Amount", "Paystack Ref", "Referral Code", "IP (optional)"];
SHEET_HEADERS[SHEETS.AMB] = ["Timestamp", "Full Name", "Email", "Phone", "Social Handle", "Why Ambassador", "Referral Code", "Magic Token", "Status"];
SHEET_HEADERS[SHEETS.CLICKS] = ["Timestamp", "Referral Code", "IP (optional)"];

function setupSheets() {
  const spreadsheet = ss_();
  Object.keys(SHEET_HEADERS).forEach((sheetName) => {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    const headers = SHEET_HEADERS[sheetName];
    const existingHeaders = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    const hasAnyHeader = existingHeaders.some((value) => String(value).trim() !== "");
    if (!hasAnyHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }

    const normalizedExisting = existingHeaders.slice(0, headers.length).map((value) => String(value).trim());
    const normalizedRequired = headers.map((value) => String(value).trim());
    if (JSON.stringify(normalizedExisting) !== JSON.stringify(normalizedRequired)) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.setFrozenRows(1);
  });
}

function doGet(e) {
  const action = (e.parameter.action || "").trim();
  try {
    if (action === "track_click") return jsonResponse(trackClick_(e.parameter.ref || ""));
    if (action === "get_dashboard") return jsonResponse(getDashboard_(e.parameter.token || ""));
    if (action === "get_admin") return jsonResponse(getAdmin_(e.parameter.adminToken || ""));
    return jsonResponse({ success: false, message: "Unsupported action" });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

function doPost(e) {
  const action = (e.parameter.action || "").trim();
  try {
    if (action === "register") return jsonResponse(handleRegister_(e.parameter));
    if (action === "ambassador_signup") return jsonResponse(handleAmbassadorSignup_(e.parameter));
    return jsonResponse({ success: false, message: "Unsupported action" });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error("Missing sheet: " + name);
  return s;
}

function values_(sheetName) {
  const values = sh_(sheetName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row) => {
    const o = {};
    headers.forEach((h, i) => (o[String(h)] = row[i]));
    return o;
  });
}

function validateRequired_(payload, required) {
  required.forEach((k) => {
    if (!payload[k]) throw new Error("Missing required field: " + k);
  });
}

function handleRegister_(p) {
  validateRequired_(p, ["fullName", "email", "phone", "ticketType", "amount", "paystackRef"]);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const existing = findRegistrationByPaystackRef_(p.paystackRef);
    if (existing) {
      return { success: true, ref: p.paystackRef, deduped: true, message: "Registration already processed." };
    }

    const verification = verifyPaystackTransaction_(p.paystackRef);
    if (!verification.success) {
      throw new Error(verification.message || "Unable to verify payment.");
    }

    const amountPaid = Number(verification.amount || 0) / 100;
    if (Math.abs(amountPaid - Number(p.amount)) > 0.1) throw new Error("Payment amount mismatch.");

    sh_(SHEETS.REG).appendRow([
      new Date(),
      p.fullName,
      p.email,
      p.phone,
      p.company || "",
      p.role || "",
      p.ticketType,
      Number(p.amount),
      p.paystackRef,
      p.referralCode || "",
      "",
    ]);

    sendTicketEmail_(p.fullName, p.email, p.ticketType, p.amount, p.paystackRef);
    sendAdminNotification_(p);
    return { success: true, ref: p.paystackRef };
  } finally {
    lock.releaseLock();
  }
}

function handleAmbassadorSignup_(p) {
  validateRequired_(p, ["fullName", "email", "phone", "why"]);
  const code = generateReferralCode_();
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  sh_(SHEETS.AMB).appendRow([new Date(), p.fullName, p.email, p.phone, p.socialHandle || "", p.why, code, token, "active"]);
  sendAmbassadorWelcome_(p.fullName, p.email, code, token);
  return { success: true };
}

function trackClick_(ref) {
  if (!ref) return { success: true };
  sh_(SHEETS.CLICKS).appendRow([new Date(), ref, ""]);
  return { success: true };
}

function getDashboard_(token) {
  if (!token) return { success: false, message: "Invalid token" };
  const ambassadors = values_(SHEETS.AMB);
  const registrations = values_(SHEETS.REG);
  const clicks = values_(SHEETS.CLICKS);
  const amb = ambassadors.find((a) => String(a["Magic Token"]) === token && String(a["Status"]).toLowerCase() === "active");
  if (!amb) return { success: false, message: "Invalid token" };

  const code = String(amb["Referral Code"]);
  const mine = registrations.filter((r) => String(r["Referral Code"]) === code);
  const totalEarnings = mine.reduce((sum, r) => sum + commissionFor_(String(r["Ticket Type"]), Number(r["Amount"])), 0);
  const rowData = mine.map((r) => ({
    date: r["Timestamp"],
    name: r["Full Name"],
    ticketType: r["Ticket Type"],
    amount: Number(r["Amount"]) || 0,
    commission: commissionFor_(String(r["Ticket Type"]), Number(r["Amount"])),
  }));

  return {
    success: true,
    data: {
      ambassador: {
        name: amb["Full Name"],
        email: amb["Email"],
        referralCode: code,
        referralLink: BASE_DOMAIN + "/?ref=" + code,
      },
      stats: {
        totalClicks: clicks.filter((c) => String(c["Referral Code"]) === code).length,
        totalSales: mine.length,
        totalEarnings: totalEarnings,
      },
      registrations: rowData,
    },
  };
}

function getAdmin_(adminToken) {
  if (adminToken !== ADMIN_TOKEN) return { success: false, message: "Unauthorized" };
  const registrations = values_(SHEETS.REG).map((r) => ({
    timestamp: r["Timestamp"],
    fullName: r["Full Name"],
    email: r["Email"],
    phone: r["Phone"],
    company: r["Company"],
    role: r["Role"],
    ticketType: r["Ticket Type"],
    amount: Number(r["Amount"]) || 0,
    paystackRef: r["Paystack Ref"],
    referralCode: r["Referral Code"],
  }));
  const ambassadorsRaw = values_(SHEETS.AMB);
  const clicks = values_(SHEETS.CLICKS);

  const ambassadors = ambassadorsRaw.map((a) => {
    const code = String(a["Referral Code"]);
    const sales = registrations.filter((r) => String(r.referralCode) === code);
    const totalSales = sales.length;
    const totalEarnings = sales.reduce((sum, s) => sum + commissionFor_(s.ticketType, s.amount), 0);
    const rewardStatus = totalSales >= 10 ? "5-sale + 10-sale unlocked" : totalSales >= 5 ? "5-sale unlocked" : "In progress";
    return {
      fullName: a["Full Name"],
      email: a["Email"],
      referralCode: code,
      totalClicks: clicks.filter((c) => String(c["Referral Code"]) === code).length,
      totalSales: totalSales,
      totalEarnings: totalEarnings,
      rewardStatus: rewardStatus,
    };
  });

  const totalRevenue = registrations.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const earlyBirdSales = registrations.filter((r) => String(r.ticketType).toLowerCase() === "early bird").length;
  const regularSales = registrations.filter((r) => String(r.ticketType).toLowerCase() === "regular").length;
  const totalCommissionOwed = ambassadors.reduce((sum, a) => sum + a.totalEarnings, 0);

  return {
    success: true,
    data: {
      stats: {
        totalRegistrations: registrations.length,
        totalRevenue: totalRevenue,
        earlyBirdSales: earlyBirdSales,
        regularSales: regularSales,
        totalAmbassadors: ambassadors.length,
        totalCommissionOwed: totalCommissionOwed,
      },
      registrations: registrations,
      ambassadors: ambassadors,
    },
  };
}

function verifyPaystackTransaction_(reference) {
  const options = {
    method: "get",
    headers: { Authorization: "Bearer " + PAYSTACK_SECRET_KEY },
    muteHttpExceptions: true,
  };
  const url = "https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference);
  try {
    const response = UrlFetchApp.fetch(url, options);
    const body = JSON.parse(response.getContentText() || "{}");
    if (body.status !== true || !body.data || body.data.status !== "success") {
      return { success: false, message: "Payment verification failed." };
    }
    return { success: true, amount: Number(body.data.amount || 0) };
  } catch (error) {
    const message = String((error && error.message) || error || "");
    if (message.toLowerCase().indexOf("bandwidth quota exceeded") !== -1) {
      return { success: false, message: "Payment provider check is temporarily busy. Please retry in a minute." };
    }
    return { success: false, message: "Unable to reach payment verification service right now." };
  }
}

function findRegistrationByPaystackRef_(paystackRef) {
  if (!paystackRef) return null;
  const registrations = values_(SHEETS.REG);
  return registrations.find((r) => String(r["Paystack Ref"]) === String(paystackRef)) || null;
}

function generateReferralCode_() {
  const existing = new Set(values_(SHEETS.AMB).map((a) => String(a["Referral Code"])));
  while (true) {
    const code = "MSM-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    if (!existing.has(code)) return code;
  }
}

function commissionFor_(ticketType, amount) {
  if (String(ticketType).toLowerCase() === "early bird" || Number(amount) === 150) return 22.5;
  return 30;
}

function sendTicketEmail_(name, email, ticketType, amount, ref) {
  const subject = "You're In! Your MSM Workshop Ticket";
  const html = '<div style="font-family:Montserrat,Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:28px;border:1px solid #c9a84c;max-width:560px;margin:auto;">' +
    '<h1 style="font-family:Bebas Neue,Arial,sans-serif;letter-spacing:1px;margin:0;color:#e0c070;">THE MSM WORKSHOP</h1>' +
    '<p style="margin:0 0 18px 0;">Mind. Skills. Momentum.</p><hr style="border-color:#c9a84c;" />' +
    '<h2 style="color:#ffffff;">&#127915; YOUR TICKET</h2>' +
    "<p>Name: " + name + "<br>Ticket Type: " + ticketType + "<br>Amount Paid: GHS " + amount + "<br>Ticket ID: " + ref + "<br>Date: June 5, 2026<br>Location: Accra, Ghana</p>" +
    '<hr style="border-color:#c9a84c;" /><p>Please present this email at the entrance.<br>We look forward to seeing you.<br><br>— The MSM Workshop Team</p></div>';
  GmailApp.sendEmail(email, subject, "Your ticket is ready.", { htmlBody: html, name: "The MSM Workshop" });
}

function sendAdminNotification_(p) {
  const subject = "New Registration — " + p.fullName;
  const referral = p.referralCode || "Direct";
  const timestamp = new Date();
  const body = "New registration received.\n\n" +
    "Name: " + p.fullName + "\nEmail: " + p.email + "\nPhone: " + p.phone + "\nTicket Type: " + p.ticketType +
    "\nAmount: GHS " + p.amount + "\nPaystack Ref: " + p.paystackRef + "\nReferred By: " + referral + "\nTime: " + timestamp;
  const html = '<div style="font-family:Montserrat,Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:24px;max-width:620px;margin:auto;border:1px solid #c9a84c;border-radius:10px;">' +
    '<div style="border-bottom:1px solid rgba(201,168,76,0.45);padding-bottom:12px;margin-bottom:16px;">' +
    '<h2 style="margin:0;font-family:Bebas Neue,Arial,sans-serif;letter-spacing:1px;color:#e0c070;">NEW REGISTRATION ALERT</h2>' +
    '<p style="margin:6px 0 0 0;color:#aaaaaa;">The MSM Workshop admin notification</p></div>' +
    '<table style="width:100%;border-collapse:collapse;">' +
    '<tr><td style="padding:8px 0;color:#aaaaaa;">Name</td><td style="padding:8px 0;color:#ffffff;font-weight:600;">' + p.fullName + "</td></tr>" +
    '<tr><td style="padding:8px 0;color:#aaaaaa;">Email</td><td style="padding:8px 0;color:#ffffff;">' + p.email + "</td></tr>" +
    '<tr><td style="padding:8px 0;color:#aaaaaa;">Phone</td><td style="padding:8px 0;color:#ffffff;">' + p.phone + "</td></tr>" +
    '<tr><td style="padding:8px 0;color:#aaaaaa;">Ticket Type</td><td style="padding:8px 0;color:#ffffff;">' + p.ticketType + "</td></tr>" +
    '<tr><td style="padding:8px 0;color:#aaaaaa;">Amount</td><td style="padding:8px 0;color:#ffffff;">GHS ' + p.amount + "</td></tr>" +
    '<tr><td style="padding:8px 0;color:#aaaaaa;">Paystack Ref</td><td style="padding:8px 0;color:#ffffff;">' + p.paystackRef + "</td></tr>" +
    '<tr><td style="padding:8px 0;color:#aaaaaa;">Referred By</td><td style="padding:8px 0;color:#ffffff;">' + referral + "</td></tr>" +
    '<tr><td style="padding:8px 0;color:#aaaaaa;">Time</td><td style="padding:8px 0;color:#ffffff;">' + timestamp + "</td></tr>" +
    "</table>" +
    '<p style="margin-top:18px;color:#aaaaaa;">Track all records in the MSM registration sheet.</p></div>';
  ADMIN_EMAILS.forEach((email) => GmailApp.sendEmail(email, subject, body, { htmlBody: html, name: "The MSM Workshop" }));
}

function sendAmbassadorWelcome_(name, email, code, token) {
  const subject = "Welcome to the MSM Ambassador Program";
  const referralLink = BASE_DOMAIN + "/?ref=" + code;
  const dashboardLink = BASE_DOMAIN + "/dashboard.html?token=" + token;
  const body = "Hi " + name + ",\n\nYou're officially an MSM Ambassador.\n\nYOUR REFERRAL LINK:\n" + BASE_DOMAIN + "/?ref=" + code +
    "\n\nYOUR DASHBOARD:\n" + BASE_DOMAIN + "/dashboard.html?token=" + token +
    "\n\nCOMMISSION STRUCTURE:\n- GHS 150 ticket → GHS 22.50 per sale\n- GHS 200 ticket → GHS 30.00 per sale\n\nREWARDS:\n- 5 sales → Free Ticket\n- 10 sales → Free Ticket + Volunteer Role\n\nShare your link. Track your earnings. Win big.\n\n— The MSM Workshop Team";
  const html = '<div style="font-family:Montserrat,Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:26px;max-width:620px;margin:auto;border:1px solid #c9a84c;border-radius:10px;">' +
    '<h1 style="margin:0;font-family:Bebas Neue,Arial,sans-serif;letter-spacing:1px;color:#e0c070;">WELCOME, MSM AMBASSADOR</h1>' +
    '<p style="margin:10px 0 16px 0;color:#ffffff;">Hi ' + name + ", you're officially in.</p>" +
    '<div style="background:#161616;border:1px solid rgba(201,168,76,0.35);padding:14px;border-radius:8px;margin-bottom:12px;">' +
    '<p style="margin:0 0 6px 0;color:#aaaaaa;font-size:12px;letter-spacing:0.4px;">YOUR REFERRAL LINK</p>' +
    '<p style="margin:0;color:#f5f0e8;word-break:break-all;">' + referralLink + "</p></div>" +
    '<div style="background:#161616;border:1px solid rgba(201,168,76,0.35);padding:14px;border-radius:8px;margin-bottom:16px;">' +
    '<p style="margin:0 0 6px 0;color:#aaaaaa;font-size:12px;letter-spacing:0.4px;">YOUR DASHBOARD</p>' +
    '<p style="margin:0;color:#f5f0e8;word-break:break-all;">' + dashboardLink + "</p></div>" +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">' +
    '<a href="' + referralLink + '" style="display:inline-block;background:linear-gradient(130deg,#c9a84c,#e0c070);color:#0d0d0d;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;">Open Referral Link</a>' +
    '<a href="' + dashboardLink + '" style="display:inline-block;background:#1f1f1f;color:#f5f0e8;text-decoration:none;padding:10px 16px;border-radius:999px;border:1px solid rgba(201,168,76,0.45);font-weight:700;">Open Dashboard</a>' +
    "</div>" +
    '<p style="margin:0 0 8px 0;color:#e0c070;font-weight:700;">Commission Structure</p>' +
    '<p style="margin:0;color:#f5f0e8;">- GHS 150 ticket -> GHS 22.50 per sale<br>- GHS 200 ticket -> GHS 30.00 per sale</p>' +
    '<p style="margin:16px 0 8px 0;color:#e0c070;font-weight:700;">Rewards</p>' +
    '<p style="margin:0;color:#f5f0e8;">- 5 sales -> Free Ticket<br>- 10 sales -> Free Ticket + Volunteer Role</p>' +
    '<p style="margin-top:16px;color:#aaaaaa;">Share your link. Track your earnings. Win big.<br>— The MSM Workshop Team</p></div>';
  GmailApp.sendEmail(email, subject, body, { htmlBody: html, name: "The MSM Workshop" });
}