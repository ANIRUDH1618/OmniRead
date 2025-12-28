document.addEventListener("DOMContentLoaded", () => {
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

  // --- TEXT CONSTANTS (Dramatic) ---
  const TEXT_DEFAULT =
    "It happens to the best of scholars. Provide your email, and we shall send a cipher to restore your access.";
  const TEXT_SILENCE =
    "Silence will not open these gates. I need an address to send the courier.";
  const TEXT_APPRAISAL = "The quill moves. Good. Proceed.";
  const TEXT_COURIER_SENT =
    "The courier has been dispatched. Seek the cipher in your inbox.";
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
      icon.classList.add("ri-lock-line"); // Default lock
    }
  };

  // --- 2. VOICE & UX HELPERS ---
  // --- 2. VOICE & UX HELPERS (UPDATED FOR MOBILE) ---
  const statusVoiceMobile = document.getElementById("status-voice-mobile"); // NEW

  function updateVoice(text, className, mobileText = null) {
      // Desktop
      if(statusVoice) {
          statusVoice.innerText = text;
          statusVoice.className = className;
      }
      // Mobile
      if(statusVoiceMobile) {
          statusVoiceMobile.innerText = mobileText || text;
          if (className.includes('text-drama')) statusVoiceMobile.className = "text-xs text-red-500 font-bold font-serif italic mb-4 animate-pulse";
          else if (className.includes('text-appraisal')) statusVoiceMobile.className = "text-xs text-green-500 font-bold font-serif mb-4";
          else statusVoiceMobile.className = "text-xs text-gray-400 font-serif italic mb-4";
      }
  }

  function setVoiceError(text) {
    isErrorState = true;
    updateVoice(text, "text-drama text-lg leading-relaxed min-h-[80px]", "⚠️ " + text);
  }

  function setVoiceAppraisal() {
    if (!isErrorState) return;
    updateVoice(TEXT_APPRAISAL, "text-appraisal text-lg leading-relaxed min-h-[80px]", "✅ " + TEXT_APPRAISAL);

    if (appraisalTimeout) clearTimeout(appraisalTimeout);
    appraisalTimeout = setTimeout(() => {
      resetVoice();
    }, 2000);
  }

  function resetVoice() {
    isErrorState = false;
    updateVoice(TEXT_DEFAULT, "text-default text-lg leading-relaxed min-h-[80px]", "");
  }

  function triggerInputError(inputElement) {
    inputElement.classList.add("input-error");
    const group = inputElement.closest(".relative");
    const icon = group.querySelector(".input-icon");
    if (icon) {
      icon.classList.add("icon-error");
      icon.classList.remove(
        "text-gray-500",
        "group-focus-within:text-brand-cyan"
      );
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

  // --- 3. INPUT LISTENERS (For Appraisal) ---
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      resetValidationStyles();
      if (isErrorState) {
        setVoiceAppraisal();
      }
    });
  });

  // --- 4. STEP 1: SEND OTP LOGIC ---
  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("forgot-email");

    // [FIX] Convert to lowercase and remove spaces before sending to server
    userEmail = emailInput.value.toLowerCase().trim();

    if (!userEmail) return;

    // [DRAMATIC VALIDATION]
    if (!userEmail) {
      triggerInputError(emailInput);
      setVoiceError(TEXT_SILENCE);
      return;
    }

    // UI Loading
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
        // Success
        statusVoice.innerText = TEXT_COURIER_SENT;
        statusVoice.className =
          "text-vermilion text-lg font-serif italic font-bold";

        step1.classList.add("hidden");
        step2.classList.remove("hidden");
      } else {
        throw new Error(data.message || "User not found");
      }
    } catch (error) {
      setVoiceError(
        "I cannot find that address in the archives. Are you sure you are registered?"
      );
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

    // Basic Validation
    if (!otp || !newPass || !confirmPass) {
      setVoiceError(
        "Do not leave fields empty. The ritual requires completeness."
      );
      return;
    }

    if (newPass !== confirmPass) {
      triggerInputError(newPassInput);
      triggerInputError(confirmPassInput);
      setVoiceError(TEXT_MISMATCH);
      return;
    }

    // UI Loading
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