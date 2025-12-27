document.addEventListener("DOMContentLoaded", async () => {
  // --- ELEMENTS ---
  const nameEl = document.getElementById("profile-name");
  const imgEl = document.getElementById("profile-image");
  const inputName = document.getElementById("input-name");
  const inputEmail = document.getElementById("input-email");
  const logoutBtn = document.getElementById("logout-btn");
  
  const form = document.getElementById("profile-form");
  const avatarInput = document.getElementById("avatar-input");
  const updateBtn = document.getElementById("update-btn");

  // --- 1. FETCH USER DATA ---
  try {
    const res = await fetch("/api/me");
    const data = await res.json();

    if (data.success) {
      const user = data.data;

      // Populate text fields
      nameEl.innerText = user.name;
      inputName.value = user.name;
      inputEmail.value = user.email;

      // Logic: Trust the DB for image
      if (imgEl) {
          imgEl.src = user.photo;
          imgEl.onerror = () => {
              imgEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ea580c&color=fff&size=200`;
          };
      }
    } else {
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Failed to load identity:", error);
  }

  // --- 2. IMAGE PREVIEW ---
  if (avatarInput && imgEl) {
      avatarInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                  imgEl.src = e.target.result; // Instant preview
              };
              reader.readAsDataURL(file);
          }
      });
  }

  // --- 3. UPDATE LEDGER (DRAMATIC SAVE) ---
  if (form) {
      form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          // UI Loading State
          const originalBtnContent = updateBtn.innerHTML;
          updateBtn.disabled = true;
          updateBtn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> Inscribing...`;
          
          const formData = new FormData();
          formData.append('name', inputName.value);
          if (avatarInput.files[0]) {
              formData.append('avatar', avatarInput.files[0]);
          }

          try {
              const res = await fetch('/api/me/update', {
                  method: 'PUT',
                  body: formData
              });
              const data = await res.json();

              if (data.success) {
                  // Update sidebar/static text
                  nameEl.innerText = data.data.user.name;
                  
                  // DRAMATIC SUCCESS EFFECT
                  updateBtn.classList.remove('bg-ink-900', 'dark:bg-white', 'text-white', 'dark:text-black');
                  updateBtn.classList.add('bg-green-600', 'text-white', 'scale-105');
                  updateBtn.innerHTML = `<i class="ri-check-double-line"></i> Ledger Updated`;
                  
                  // Flash the card border
                  const card = document.querySelector('.max-w-4xl');
                  card.classList.add('ring-4', 'ring-green-500/50', 'transition-all');

                  setTimeout(() => {
                      // Revert styles
                      updateBtn.classList.add('bg-ink-900', 'dark:bg-white', 'text-white', 'dark:text-black');
                      updateBtn.classList.remove('bg-green-600', 'text-white', 'scale-105');
                      updateBtn.innerHTML = originalBtnContent;
                      updateBtn.disabled = false;
                      card.classList.remove('ring-4', 'ring-green-500/50');
                  }, 2000);

              } else {
                  alert("Failed to update ledger.");
                  updateBtn.innerHTML = originalBtnContent;
                  updateBtn.disabled = false;
              }
          } catch (err) {
              console.error(err);
              updateBtn.innerHTML = "Error";
              setTimeout(() => {
                  updateBtn.innerHTML = originalBtnContent;
                  updateBtn.disabled = false;
              }, 2000);
          }
      });
  }

  // --- 4. LOGOUT LOGIC ---
  if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await fetch("/api/logout");
          window.location.href = "/login";
        } catch (err) {
          console.error("Logout failed", err);
        }
      });
  }
});