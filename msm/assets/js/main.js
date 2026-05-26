const GAS_URL = "https://script.google.com/macros/s/AKfycbw4hbh_KiOI0SLcB5410CDEcoLYwZo0JbMZdJfkkzWqiZPxw5rUxsFoGcy-T7U1uFvKeA/exec";
const PAYSTACK_KEY = "pk_live_3d6ce753f1b6ef979bff8653d41ee33ac1a9c427";
const EARLY_BIRD_END = new Date("2026-06-01T23:59:59Z");
const ATTENDEES_WHATSAPP_URL = "https://chat.whatsapp.com/EF0BBIF0WBfCZqn0Pu3UcC?mode=gi_t";

let registrationSoldOut = Boolean(window.MSM_CONFIG?.registrationSoldOut);

const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

function setStatus(el, message, type) {
  el.textContent = message || "";
  el.className = `status ${type || ""}`.trim();
}

function setLoading(button, loading, label, loadingLabel) {
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = label || button.textContent.trim();
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.textContent = loading ? loadingLabel || "Processing..." : button.dataset.defaultLabel;
}

function setupSuccessModal() {
  const modal = qs("#successModal");
  const closeBtn = qs("#successModalClose");
  const okBtn = qs("#successModalOk");
  const joinWhatsappBtn = qs("#successModalJoinWhatsapp");
  if (!modal) return { open: () => {}, close: () => {} };

  const close = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const open = () => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  closeBtn?.addEventListener("click", close);
  okBtn?.addEventListener("click", close);
  joinWhatsappBtn?.addEventListener("click", () => {
    window.open(ATTENDEES_WHATSAPP_URL, "_blank", "noopener");
    close();
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) close();
  });

  return { open, close };
}

function urlEncode(data) {
  return new URLSearchParams(data).toString();
}

function generateRef() {
  return `MSM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

function getCookie(name) {
  const parts = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return parts ? decodeURIComponent(parts.split("=")[1]) : "";
}

function getReferralCode() {
  return sessionStorage.getItem("msm_ref") || getCookie("msm_ref") || "";
}

function setupReferralTracking() {
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref) return;
  sessionStorage.setItem("msm_ref", ref);
  document.cookie = `msm_ref=${encodeURIComponent(ref)}; max-age=${7 * 24 * 60 * 60}; path=/`;
  fetch(`${GAS_URL}?action=track_click&ref=${encodeURIComponent(ref)}`).catch(() => {});
}

function setupHeaderAndNav() {
  const header = qs("#site-header");
  const navLinks = qsa("#nav-links a");
  const nav = qs("#nav-links");
  const hamburger = qs("#hamburger");
  const sections = qsa("section[id]");

  hamburger?.addEventListener("click", () => nav.classList.toggle("mobile-menu"));
  navLinks.forEach((link) => {
    link.addEventListener("click", () => nav.classList.remove("mobile-menu"));
  });

  const update = () => {
    header.classList.toggle("scrolled", window.scrollY > 24);
    let current = "";
    sections.forEach((s) => {
      if (window.scrollY >= s.offsetTop - 120) current = `#${s.id}`;
    });
    navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === current));
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function setupCountdown() {
  const el = qs("#countdown");
  if (!el) return;
  const tick = () => {
    const diff = EARLY_BIRD_END.getTime() - Date.now();
    if (diff <= 0) {
      el.textContent = "Early bird closed";
      return;
    }
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    el.textContent = `${d}d ${h}h left`;
  };
  tick();
  setInterval(tick, 60000);
}

let activePromoCode = "";

function clearPromoSelection() {
  activePromoCode = "";
  const promoHidden = qs("#promoCode");
  const promoInput = qs("#promoCodeInput");
  const promoApplied = qs("#promoApplied");
  const promoFeedback = qs("#promoFeedback");
  const amount = qs("#amount");
  const registerBtn = qs("#registerBtn");
  if (promoHidden) promoHidden.value = "";
  if (promoInput) promoInput.disabled = false;
  if (promoApplied) promoApplied.hidden = true;
  if (promoFeedback) {
    promoFeedback.textContent = "";
    promoFeedback.className = "promo-feedback muted";
  }
  if (registerBtn) registerBtn.textContent = "SECURE YOUR SEAT NOW";
  const selected = document.querySelector(".price-card.selected");
  if (selected && amount) amount.value = selected.dataset.amount;
}

function applyPromoUi(message) {
  const promoApplied = qs("#promoApplied");
  const promoFeedback = qs("#promoFeedback");
  const amount = qs("#amount");
  const registerBtn = qs("#registerBtn");
  if (promoApplied) promoApplied.hidden = false;
  if (promoFeedback) {
    promoFeedback.textContent = message || "Ticket covered by Revolead";
    promoFeedback.className = "promo-feedback success";
  }
  if (amount) amount.value = "0";
  if (registerBtn) registerBtn.textContent = "COMPLETE REGISTRATION";
}

async function validatePromoOnServer(code) {
  const res = await fetch(`${GAS_URL}?action=validate_promo&code=${encodeURIComponent(code)}`);
  return res.json();
}

function setupPromoCode() {
  const promoInput = qs("#promoCodeInput");
  const applyBtn = qs("#applyPromoBtn");
  const removeBtn = qs("#removePromoBtn");
  const promoHidden = qs("#promoCode");
  if (!promoInput || !applyBtn || !promoHidden) return;

  const apply = async () => {
    const code = promoInput.value.trim();
    const promoFeedback = qs("#promoFeedback");
    if (!code) {
      if (promoFeedback) {
        promoFeedback.textContent = "Enter a promo code.";
        promoFeedback.className = "promo-feedback error";
      }
      return;
    }
    setLoading(applyBtn, true, "Apply", "Checking...");
    try {
      const data = await validatePromoOnServer(code);
      if (!data.success) throw new Error(data.message || "Invalid promo code.");
      activePromoCode = code;
      promoHidden.value = code;
      promoInput.disabled = true;
      applyPromoUi(data.message);
    } catch (error) {
      clearPromoSelection();
      if (promoFeedback) {
        promoFeedback.textContent = error.message || "Invalid promo code.";
        promoFeedback.className = "promo-feedback error";
      }
    } finally {
      setLoading(applyBtn, false, "Apply");
    }
  };

  applyBtn.addEventListener("click", apply);
  promoInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    }
  });
  removeBtn?.addEventListener("click", clearPromoSelection);
}

function setupPricing() {
  const early = qs("#earlyBirdCard");
  const regular = qs("#regularCard");
  const cards = [early, regular];
  const ticketType = qs("#ticketType");
  const amount = qs("#amount");
  const buttons = qsa(".select-ticket");
  const earlyClosed = new Date() > EARLY_BIRD_END;

  if (earlyClosed) {
    early.classList.add("closed");
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "CLOSED";
    early.appendChild(badge);
    early.querySelector("button").disabled = true;
    selectCard(regular);
  } else {
    selectCard(early);
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".price-card");
      if (card.classList.contains("closed")) return;
      selectCard(card);
      qs("#register").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  cards.forEach((card) => {
    if (!card) return;
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      if (card.classList.contains("closed")) return;
      selectCard(card);
    });
  });

  function selectCard(card) {
    if (activePromoCode) clearPromoSelection();
    [early, regular].forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    ticketType.value = card.dataset.type;
    amount.value = card.dataset.amount;
  }
}

function submitRegistration(payload) {
  return fetch(`${GAS_URL}?action=register`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: urlEncode(payload),
  }).then((r) => r.json());
}

function submitWaitlist(payload) {
  return fetch(`${GAS_URL}?action=waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: urlEncode(payload),
  }).then((r) => r.json());
}

async function fetchEventStatus() {
  try {
    const res = await fetch(`${GAS_URL}?action=event_status`);
    const data = await res.json();
    if (data.success && typeof data.soldOut === "boolean") {
      registrationSoldOut = data.soldOut;
      return;
    }
  } catch {
    /* use config fallback */
  }
  registrationSoldOut = Boolean(window.MSM_CONFIG?.registrationSoldOut);
}

function applySoldOutUi() {
  document.documentElement.classList.toggle("is-sold-out", registrationSoldOut);
  document.body.classList.toggle("is-sold-out", registrationSoldOut);

  const heroBadges = qs("#heroBadges");
  const heroMeta = qs("#heroMeta");
  const navRegister = qs("#navRegisterLink");
  const registerCtas = qsa(".cta-register, #heroCta, #finalCta");

  if (!registrationSoldOut) return;

  if (heroBadges) {
    heroBadges.innerHTML = '<span class="pill pill-sold-out">Sold Out</span>';
  }
  if (heroMeta) {
    heroMeta.textContent = "Registration is closed. Join the waitlist for a chance to attend.";
  }
  if (navRegister) navRegister.textContent = "Waitlist";
  registerCtas.forEach((el) => {
    el.textContent = "JOIN THE WAITLIST";
    el.setAttribute("href", "#register");
  });
}

function setupWaitlistModal() {
  const modal = qs("#waitlistModal");
  const closeBtn = qs("#waitlistModalClose");
  const okBtn = qs("#waitlistModalOk");
  if (!modal) return { open: () => {}, close: () => {} };

  const close = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const open = () => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  closeBtn?.addEventListener("click", close);
  okBtn?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) close();
  });

  return { open, close };
}

function setupWaitlistForm() {
  const form = qs("#waitlistForm");
  const status = qs("#waitlistStatus");
  const button = qs("#waitlistBtn");
  const waitlistModal = setupWaitlistModal();
  if (!form || !button) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(status, "", "");
    const data = Object.fromEntries(new FormData(form).entries());
    setLoading(button, true, "JOIN THE WAITLIST", "Submitting...");
    try {
      const res = await submitWaitlist({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        company: data.company || "",
        role: data.role || "",
      });
      if (!res.success) throw new Error(res.message || "Unable to join the waitlist.");
      setStatus(status, res.message || "You are on the waitlist.", "success");
      form.reset();
      waitlistModal.open();
    } catch (err) {
      setStatus(status, err.message || "Something went wrong. Please try again.", "error");
    } finally {
      setLoading(button, false, "JOIN THE WAITLIST");
    }
  });
}

function launchPaystack(formData, onSuccess, onClose) {
  const handler = PaystackPop.setup({
    key: PAYSTACK_KEY,
    email: formData.email,
    amount: Number(formData.amount) * 100,
    currency: "GHS",
    ref: generateRef(),
    metadata: {
      custom_fields: [
        { display_name: "Full Name", variable_name: "full_name", value: formData.fullName },
        { display_name: "Phone", variable_name: "phone", value: formData.phone },
        { display_name: "Ticket Type", variable_name: "ticket_type", value: formData.ticketType },
      ],
    },
    callback: onSuccess,
    onClose,
  });
  handler.openIframe();
}

function setupRegistrationForm() {
  const form = qs("#registrationForm");
  const status = qs("#registerStatus");
  const button = qs("#registerBtn");
  const referralInput = qs("#referralCode");
  const successModal = setupSuccessModal();
  referralInput.value = getReferralCode();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(status, "", "");
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.ticketType) {
      setStatus(status, "Please select a ticket option first.", "error");
      return;
    }

    let promoCode = (data.promoCode || activePromoCode || data.promoCodeInput || "").trim();
    if (promoCode && !activePromoCode) {
      setLoading(button, true, "SECURE YOUR SEAT NOW", "Checking promo...");
      try {
        const check = await validatePromoOnServer(promoCode);
        if (!check.success) throw new Error(check.message || "Invalid promo code.");
        activePromoCode = promoCode;
        qs("#promoCode").value = promoCode;
        applyPromoUi(check.message);
      } catch (err) {
        setStatus(status, err.message || "Invalid promo code.", "error");
        setLoading(button, false, "SECURE YOUR SEAT NOW");
        return;
      }
    }
    if (promoCode) {
      setLoading(button, true, "COMPLETE REGISTRATION", "Submitting...");
      const payload = {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        company: data.company || "",
        role: data.role || "",
        ticketType: data.ticketType,
        promoCode,
        referralCode: getReferralCode(),
      };
      submitRegistration(payload)
        .then((res) => {
          if (!res.success) throw new Error(res.message || "Unable to save registration.");
          setStatus(status, "", "");
          successModal.open();
          form.reset();
          clearPromoSelection();
          referralInput.value = getReferralCode();
        })
        .catch((err) => setStatus(status, err.message || "Something went wrong. Please try again.", "error"))
        .finally(() => setLoading(button, false, "COMPLETE REGISTRATION"));
      return;
    }

    if (!data.amount) {
      setStatus(status, "Please select a ticket option first.", "error");
      return;
    }

    setLoading(button, true, "SECURE YOUR SEAT NOW", "Processing Payment");
    launchPaystack(
      data,
      (response) => {
        qs("#paystackRef").value = response.reference;
        const payload = {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          company: data.company || "",
          role: data.role || "",
          ticketType: data.ticketType,
          amount: data.amount,
          paystackRef: response.reference,
          referralCode: getReferralCode(),
        };
        submitRegistration(payload)
          .then((res) => {
            if (!res.success) throw new Error(res.message || "Unable to save registration.");
            setStatus(status, "", "");
            successModal.open();
            form.reset();
            referralInput.value = getReferralCode();
          })
          .catch((err) => setStatus(status, err.message || "Something went wrong. Please try again.", "error"))
          .finally(() => setLoading(button, false, "SECURE YOUR SEAT NOW"));
      },
      () => {
        setStatus(status, "Payment was not completed.", "error");
        setLoading(button, false, "SECURE YOUR SEAT NOW");
      }
    );
  });
}

function setupWorkshopCarousel() {
  const root = document.querySelector(".workshop-carousel");
  const track = document.getElementById("workshopCarouselTrack");
  const dotsWrap = document.getElementById("workshopCarouselDots");
  const prevBtn = root?.querySelector(".workshop-carousel-prev");
  const nextBtn = root?.querySelector(".workshop-carousel-next");
  if (!root || !track || !dotsWrap || !prevBtn || !nextBtn) return;

  const slides = track.querySelectorAll(".workshop-carousel-slide");
  const n = slides.length;
  if (n === 0) return;

  let index = 0;
  let timer = null;
  const intervalMs = 2800;

  for (let i = 0; i < n; i++) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dot.addEventListener("click", () => {
      goTo(i);
      restartAuto();
    });
    dotsWrap.appendChild(dot);
  }

  const dots = () => dotsWrap.querySelectorAll("button");

  function goTo(i) {
    index = ((i % n) + n) % n;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots().forEach((btn, j) => {
      btn.classList.toggle("is-active", j === index);
      btn.setAttribute("aria-selected", String(j === index));
    });
  }

  function nextSlide() {
    goTo(index + 1);
  }

  function prevSlide() {
    goTo(index - 1);
  }

  function startAuto() {
    stopAuto();
    timer = window.setInterval(nextSlide, intervalMs);
  }

  function stopAuto() {
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function restartAuto() {
    stopAuto();
    startAuto();
  }

  prevBtn.addEventListener("click", () => {
    prevSlide();
    restartAuto();
  });
  nextBtn.addEventListener("click", () => {
    nextSlide();
    restartAuto();
  });

  root.addEventListener("mouseenter", stopAuto);
  root.addEventListener("mouseleave", startAuto);
  root.addEventListener("focusin", stopAuto);
  root.addEventListener("focusout", (e) => {
    if (!root.contains(e.relatedTarget)) startAuto();
  });

  let touchStartX = 0;
  track.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true }
  );
  track.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < 45) return;
      if (dx > 0) prevSlide();
      else nextSlide();
      restartAuto();
    },
    { passive: true }
  );

  goTo(0);
  startAuto();
}

function setupSpeakerBios() {
  document.querySelectorAll(".speaker-bio-wrap").forEach((wrap) => {
    const bio = wrap.querySelector(".speaker-bio");
    const btn = wrap.querySelector(".speaker-read-more");
    if (!bio || !btn) return;

    function updateTruncationUi() {
      if (bio.classList.contains("is-expanded")) {
        btn.hidden = false;
        btn.textContent = "Read less";
        btn.setAttribute("aria-expanded", "true");
        return;
      }
      bio.classList.add("is-truncated");
      bio.classList.remove("is-expanded");
      void bio.offsetHeight;
      const needsToggle = bio.scrollHeight > bio.clientHeight + 2;
      btn.hidden = !needsToggle;
      btn.textContent = "Read more";
      btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", () => {
      const expanding = !bio.classList.contains("is-expanded");
      bio.classList.toggle("is-expanded", expanding);
      bio.classList.toggle("is-truncated", !expanding);
      if (expanding) {
        btn.hidden = false;
        btn.textContent = "Read less";
        btn.setAttribute("aria-expanded", "true");
      } else {
        updateTruncationUi();
      }
    });

    updateTruncationUi();
    window.addEventListener("resize", () => {
      if (!bio.classList.contains("is-expanded")) updateTruncationUi();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await fetchEventStatus();
  applySoldOutUi();
  setupReferralTracking();
  setupHeaderAndNav();
  if (registrationSoldOut) {
    setupWaitlistForm();
  } else {
    setupCountdown();
    setupPricing();
    setupPromoCode();
    setupRegistrationForm();
  }
  setupWorkshopCarousel();
  setupSpeakerBios();
});
