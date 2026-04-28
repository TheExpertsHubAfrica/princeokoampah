const GAS_URL = "https://script.google.com/macros/s/AKfycbyG9St9cMilDzHqsEoFP7vQ6jLHeJdRgAgil-HlHgPd4WEgdQG-3zeKinqSXXuzIRqP8Q/exec";

const form = document.getElementById("ambassadorForm");
const button = document.getElementById("ambassadorBtn");
const statusEl = document.getElementById("ambassadorStatus");

function setStatus(message, type) {
  statusEl.textContent = message || "";
  statusEl.className = `status ${type || ""}`.trim();
}

function setLoading(loading) {
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = "BECOME AN AMBASSADOR";
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.textContent = loading ? "Submitting..." : button.dataset.defaultLabel;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("", "");
  setLoading(true);
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(`${GAS_URL}?action=ambassador_signup`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams(payload).toString(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Signup failed");
    setStatus("Welcome aboard! Check your email for your referral link and dashboard access.", "success");
    form.reset();
  } catch (error) {
    setStatus(error.message || "Unable to submit your signup now. Please try again.", "error");
  } finally {
    setLoading(false);
  }
});
