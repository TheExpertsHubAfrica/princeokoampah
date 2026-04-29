const GAS_URL = "https://script.google.com/macros/s/AKfycbx9P1jr7nUG0ICiSNZjgn_a6QL2Gc3XyDtK9EEWmLP-Q81Zc27ChaVnyy-xBjIqFBz7eg/exec";
const PAYSTACK_KEY = "pk_test_fae6ba8263469a9e1fe3ba838500d012d8556fc2";
const EARLY_BIRD_END = new Date("2026-05-15T23:59:59Z");

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

function setupPricing() {
  const early = qs("#earlyBirdCard");
  const regular = qs("#regularCard");
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

  function selectCard(card) {
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

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setStatus(status, "", "");
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.ticketType || !data.amount) {
      setStatus(status, "Please select a ticket option first.", "error");
      return;
    }
    setLoading(button, true, "SECURE YOUR SEAT NOW", "Processing Payment");
    launchPaystack(
      data,
      (response) => {
        qs("#paystackRef").value = response.reference;
        const payload = { ...data, paystackRef: response.reference, referralCode: getReferralCode() };
        submitRegistration(payload)
          .then((res) => {
            if (!res.success) throw new Error(res.message || "Unable to save registration.");
            setStatus(status, "", "");
            successModal.open();
            form.reset();
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

document.addEventListener("DOMContentLoaded", () => {
  setupReferralTracking();
  setupHeaderAndNav();
  setupCountdown();
  setupPricing();
  setupRegistrationForm();
  setupWorkshopCarousel();
  setupSpeakerBios();
});
