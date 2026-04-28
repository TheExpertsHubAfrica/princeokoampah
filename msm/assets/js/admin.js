const GAS_URL = "https://script.google.com/macros/s/AKfycbx9P1jr7nUG0ICiSNZjgn_a6QL2Gc3XyDtK9EEWmLP-Q81Zc27ChaVnyy-xBjIqFBz7eg/exec";
const ADMIN_TOKEN = "msmadmin2026secure";
const ADMIN_HASH = "8795b99c3abe1902a4f56f239398b8f1b1ecf9071f9bde17c31652f44dd4c073";
const fmt = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let adminData = null;
const loginButton = document.querySelector("#adminLoginForm button[type='submit']");
const exportRegsBtn = document.getElementById("exportRegs");
const exportAmbBtn = document.getElementById("exportAmb");

function safe(text) {
  return String(text ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function setLoginStatus(message, type) {
  const status = document.getElementById("adminLoginStatus");
  status.textContent = message;
  status.className = `status ${type || ""}`.trim();
}

function setButtonLoading(button, loading, loadingLabel) {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent.trim();
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.textContent = loading ? loadingLabel || "Loading..." : button.dataset.defaultLabel;
}

function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function renderAdmin() {
  const s = adminData.stats;
  document.getElementById("aRegs").textContent = s.totalRegistrations;
  document.getElementById("aRev").textContent = `GHS ${fmt.format(s.totalRevenue)}`;
  document.getElementById("aEarly").textContent = s.earlyBirdSales;
  document.getElementById("aRegular").textContent = s.regularSales;
  document.getElementById("aAmb").textContent = s.totalAmbassadors;
  document.getElementById("aCom").textContent = `GHS ${fmt.format(s.totalCommissionOwed)}`;
  renderRegTable();
  renderAmbTable();
}

function renderRegTable() {
  const name = document.getElementById("searchName").value.toLowerCase();
  const email = document.getElementById("searchEmail").value.toLowerCase();
  const ticket = document.getElementById("searchTicket").value.toLowerCase();
  const rows = adminData.registrations.filter((r) => {
    return (!name || r.fullName.toLowerCase().includes(name)) && (!email || r.email.toLowerCase().includes(email)) && (!ticket || r.ticketType.toLowerCase().includes(ticket));
  });

  document.querySelector("#adminRegTable tbody").innerHTML = rows
    .map(
      (r) =>
        `<tr><td data-label="Date">${safe(r.timestamp)}</td><td data-label="Name">${safe(r.fullName)}</td><td data-label="Email">${safe(r.email)}</td><td data-label="Phone">${safe(r.phone)}</td><td data-label="Company">${safe(r.company)}</td><td data-label="Role">${safe(r.role)}</td><td data-label="Ticket Type">${safe(r.ticketType)}</td><td data-label="Amount">GHS ${fmt.format(Number(r.amount || 0))}</td><td data-label="Paystack Ref">${safe(r.paystackRef)}</td><td data-label="Referred By">${safe(r.referralCode || "Direct")}</td></tr>`
    )
    .join("");
}

function renderAmbTable() {
  document.querySelector("#adminAmbTable tbody").innerHTML = adminData.ambassadors
    .map(
      (a) =>
        `<tr><td data-label="Name">${safe(a.fullName)}</td><td data-label="Email">${safe(a.email)}</td><td data-label="Referral Code">${safe(a.referralCode)}</td><td data-label="Total Clicks">${a.totalClicks}</td><td data-label="Total Sales">${a.totalSales}</td><td data-label="Total Earnings">GHS ${fmt.format(a.totalEarnings)}</td><td data-label="Reward Status">${safe(a.rewardStatus)}</td></tr>`
    )
    .join("");
}

async function loadAdminData() {
  setButtonLoading(exportRegsBtn, true, "Loading data");
  setButtonLoading(exportAmbBtn, true, "Loading data");
  try {
    const res = await fetch(`${GAS_URL}?action=get_admin&adminToken=${encodeURIComponent(ADMIN_TOKEN)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Failed to load admin data.");
    adminData = data.data;
    renderAdmin();
  } finally {
    setButtonLoading(exportRegsBtn, false);
    setButtonLoading(exportAmbBtn, false);
  }
}

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setButtonLoading(loginButton, true, "Logging in");
  try {
    const pwd = document.getElementById("adminPassword").value;
    const hash = await sha256(pwd);
    if (hash !== ADMIN_HASH) {
      setLoginStatus("Incorrect password.", "error");
      return;
    }
    sessionStorage.setItem("msm_admin_ok", "1");
    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";
    loadAdminData().catch((err) => setLoginStatus(err.message || "Error loading dashboard.", "error"));
  } finally {
    setButtonLoading(loginButton, false);
  }
});

["searchName", "searchEmail", "searchTicket"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => adminData && renderRegTable());
});

document.getElementById("exportRegs").addEventListener("click", () => {
  if (!adminData) return;
  setButtonLoading(exportRegsBtn, true, "Exporting");
  const rows = [["Date", "Name", "Email", "Phone", "Company", "Role", "Ticket Type", "Amount", "Paystack Ref", "Referred By"]];
  adminData.registrations.forEach((r) => rows.push([r.timestamp, r.fullName, r.email, r.phone, r.company, r.role, r.ticketType, r.amount, r.paystackRef, r.referralCode || "Direct"]));
  downloadCsv("msm-registrations.csv", rows);
  setTimeout(() => setButtonLoading(exportRegsBtn, false), 500);
});

document.getElementById("exportAmb").addEventListener("click", () => {
  if (!adminData) return;
  setButtonLoading(exportAmbBtn, true, "Exporting");
  const rows = [["Name", "Email", "Referral Code", "Total Clicks", "Total Sales", "Total Earnings", "Reward Status"]];
  adminData.ambassadors.forEach((a) => rows.push([a.fullName, a.email, a.referralCode, a.totalClicks, a.totalSales, a.totalEarnings, a.rewardStatus]));
  downloadCsv("msm-ambassadors.csv", rows);
  setTimeout(() => setButtonLoading(exportAmbBtn, false), 500);
});

if (sessionStorage.getItem("msm_admin_ok") === "1") {
  document.getElementById("adminLogin").style.display = "none";
  document.getElementById("adminDashboard").style.display = "block";
  loadAdminData().catch((err) => setLoginStatus(err.message || "Error loading dashboard.", "error"));
}
