document.addEventListener("DOMContentLoaded", async () => {
  // [FIX] SECURITY: Immediately clear any existing session when entering this page
  // This prevents "Account A" remaining logged in while resetting "Account B"
  try { await fetch('/api/logout'); } catch(e) {}

  // --- UI ELEMENTS ---
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const statusVoice = document.getElementById("status-voice");

  const requestForm = document.getElementById("request-otp-form");
  const resetForm = document.getElementById("reset-pass-form");

  const btnSend = document.getElementById("btn-send-code");
  const btnReset = document.getElementById("btn-reset");

  // --- STATE VARIABLES ---
  let userEmail = "";
  let isErrorState = false;
  let appraisalTimeout;

  // --- TEXT CONSTANTS ---
  const TEXT_DEFAULT = "It happens to the best of scholars. Provide your email, and we shall send a cipher to restore your access.";
  const TEXT_SILENCE = "Silence will not open these gates. I need an address to send the courier.";
  const TEXT_APPRAISAL = "The quill moves. Good. Proceed.";
  const TEXT_COURIER_SENT = "The courier has been dispatched. Seek the cipher in your inbox.";
  const TEXT_MISMATCH = "These keys do not match. Focus, Reader.";
  const TEXT_INVALID = "That cipher is incorrect. The archives remain locked.";

  // --- 1. PASSWORD VISIBILITY TOGGLE ---
  window.togglePasswordVisibility = function (inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === "password") {
      input.type = "text";
      icon.classList.remove("ri-lock-line", "ri-lock-check-line");
      icon.classList.add("ri-lock-unlock-line");
    } else {
      input.type = "password";
      icon.classList.remove("ri-lock-unlock-line");
      icon.classList.add("ri-lock-line");
    }
  };

  // --- 2. VOICE & UX HELPERS ---
  function setVoiceError(text) {
    isErrorState = true;
    statusVoice.innerText = text;
    statusVoice.className = "text-drama text-lg leading-relaxed min-h-[80px]";
  }

  function setVoiceAppraisal() {
    if (!isErrorState) return;
    statusVoice.innerText = TEXT_APPRAISAL;
    statusVoice.className = "text-appraisal text-lg leading-relaxed min-h-[80px]";

    if (appraisalTimeout) clearTimeout(appraisalTimeout);
    appraisalTimeout = setTimeout(() => {
      resetVoice();
    }, 2000);
  }

  function resetVoice() {
    isErrorState = false;
    statusVoice.innerText = TEXT_DEFAULT;
    statusVoice.className = "text-default text-lg leading-relaxed min-h-[80px]";
  }

  function triggerInputError(inputElement) {
    inputElement.classList.add("input-error");
    const group = inputElement.closest(".relative");
    const icon = group.querySelector(".input-icon");
    if (icon) {
      icon.classList.add("icon-error");
      icon.classList.remove("text-gray-500", "group-focus-within:text-brand-cyan");
    }
  }

  function resetValidationStyles() {
    document.querySelectorAll("input").forEach((input) => {
      input.classList.remove("input-error");
    });
    document.querySelectorAll(".input-icon").forEach((icon) => {
      icon.classList.remove("icon-error");
      icon.classList.add("text-gray-500", "group-focus-within:text-brand-cyan");
    });
  }

  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      resetValidationStyles();
      if (isErrorState) setVoiceAppraisal();
    });
  });

  // --- 4. STEP 1: SEND OTP LOGIC ---
  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("forgot-email");
    userEmail = emailInput.value.toLowerCase().trim();

    if (!userEmail) {
      triggerInputError(emailInput);
      setVoiceError(TEXT_SILENCE);
      return;
    }

    const originalText = btnSend.innerText;
    btnSend.innerText = "Summoning Courier...";
    btnSend.disabled = true;
    btnSend.classList.add("opacity-75", "cursor-wait");

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        statusVoice.innerText = TEXT_COURIER_SENT;
        statusVoice.className = "text-vermilion text-lg font-serif italic font-bold";
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
      } else {
        throw new Error(data.message || "User not found");
      }
    } catch (error) {
      setVoiceError("I cannot find that address in the archives.");
      triggerInputError(emailInput);
      btnSend.innerText = originalText;
      btnSend.disabled = false;
    }
  });

  // --- 5. STEP 2: VERIFY & RESET LOGIC ---
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    resetValidationStyles();

    const otpInput = document.getElementById("otp");
    const newPassInput = document.getElementById("new-password");
    const confirmPassInput = document.getElementById("confirm-password");

    const otp = otpInput.value.trim();
    const newPass = newPassInput.value;
    const confirmPass = confirmPassInput.value;

    if (!otp || !newPass || !confirmPass) {
      setVoiceError("Do not leave fields empty.");
      return;
    }

    if (newPass !== confirmPass) {
      triggerInputError(newPassInput);
      triggerInputError(confirmPassInput);
      setVoiceError(TEXT_MISMATCH);
      return;
    }

    const originalText = btnReset.innerText;
    btnReset.innerText = "Forging New Key...";
    btnReset.disabled = true;
    btnReset.classList.add("opacity-75", "cursor-wait");

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          otp: otp,
          newPassword: newPass,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        statusVoice.innerText = "Identity Verified. Access Granted.";
        statusVoice.className = "text-appraisal text-lg font-bold";
        setTimeout(() => {
          // [FIX] Now when we redirect, we are logged in as the RIGHT user
          window.location.href = "/dashboard";
        }, 1000);
      } else {
        throw new Error(data.message || "Invalid Code");
      }
    } catch (error) {
      setVoiceError(error.message || TEXT_INVALID);
      triggerInputError(otpInput);
      btnReset.innerText = originalText;
      btnReset.disabled = false;
    }
  });
});