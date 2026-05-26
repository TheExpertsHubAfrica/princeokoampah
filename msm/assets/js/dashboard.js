const GAS_URL = "https://script.google.com/macros/s/AKfycbw4hbh_KiOI0SLcB5410CDEcoLYwZo0JbMZdJfkkzWqiZPxw5rUxsFoGcy-T7U1uFvKeA/exec";

const fmt = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const token = new URLSearchParams(window.location.search).get("token");

function showInvalid() {
  document.getElementById("dashError").style.display = "block";
}

function safe(text) {
  return String(text ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function setButtonLoading(button, loading, loadingLabel) {
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent.trim();
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.textContent = loading ? loadingLabel || "Loading..." : button.dataset.defaultLabel;
}

async function loadDashboard() {
  if (!token) return showInvalid();
  try {
    const res = await fetch(`${GAS_URL}?action=get_dashboard&token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.success || !data.data) return showInvalid();

    const d = data.data;
    document.getElementById("dashContent").style.display = "block";
    document.getElementById("ambassadorName").textContent = `${d.ambassador.name} Dashboard`;
    document.getElementById("sClicks").textContent = d.stats.totalClicks;
    document.getElementById("sRegs").textContent = d.stats.totalSales;
    document.getElementById("sEarn").textContent = `GHS ${fmt.format(d.stats.totalEarnings)}`;
    document.getElementById("sReward").textContent = `${d.stats.totalSales} of 5`;

    const link = d.ambassador.referralLink;
    document.getElementById("refLink").textContent = link;
    document.getElementById("copyBtn").onclick = async () => {
      const copyBtn = document.getElementById("copyBtn");
      try {
        setButtonLoading(copyBtn, true, "Copying");
        await navigator.clipboard.writeText(link);
        copyBtn.classList.remove("is-loading");
        copyBtn.textContent = "Copied!";
      } finally {
        setTimeout(() => setButtonLoading(copyBtn, false), 1000);
      }
    };
    document.getElementById("whatsappBtn").href = `https://wa.me/?text=${encodeURIComponent(`Join me at The MSM Workshop: ${link}`)}`;

    const tbody = document.querySelector("#regTable tbody");
    tbody.innerHTML = d.registrations
      .map(
        (r) =>
          `<tr><td data-label="Date">${safe(r.date)}</td><td data-label="Attendee Name">${safe(r.name)}</td><td data-label="Ticket Type">${safe(r.ticketType)}</td><td data-label="Amount">GHS ${fmt.format(
            Number(r.amount || 0)
          )}</td><td data-label="Commission">GHS ${fmt.format(Number(r.commission || 0))}</td></tr>`
      )
      .join("");

    const sales = d.stats.totalSales;
    document.getElementById("p5").style.width = `${Math.min((sales / 5) * 100, 100)}%`;
    document.getElementById("p10").style.width = `${Math.min((sales / 10) * 100, 100)}%`;
    document.getElementById("rewardText").textContent =
      sales >= 10 ? "Gold check: 5-sale and 10-sale rewards unlocked." : sales >= 5 ? "Gold check: Free Ticket unlocked." : "Keep sharing to unlock rewards.";
  } catch {
    showInvalid();
  }
}

loadDashboard();
