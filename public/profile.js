document.addEventListener("DOMContentLoaded", async () => {
  LayoutManager.init('profile');
  initTheme();
  
  // [FIX] Load user data to populate the profile, including the image
  if (window.loadUser) {
      await window.loadUser();
      populateProfileForm(window.appState.user);
  }

  setupEventListeners();
});

function populateProfileForm(user) {
    if (!user) return;

    // Populate Inputs
    const nameInput = document.getElementById("input-name");
    const emailInput = document.getElementById("input-email");
    if(nameInput) nameInput.value = user.name;
    if(emailInput) emailInput.value = user.email;

    // Populate Sidebar info
    document.getElementById("profile-name").innerText = user.name;
    
    // [FIX] Populate Profile Image with Fallback
    const profileImg = document.getElementById("profile-image");
    if (profileImg) {
        profileImg.src = user.photo;
        // Fallback to UI Avatars if image fails to load
        profileImg.onerror = () => {
            profileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ea580c&color=fff`;
        };
    }
}

function setupEventListeners() {
    const form = document.getElementById("profile-form");
    if(form) form.addEventListener("submit", handleProfileUpdate);

    const logoutBtn = document.getElementById("logout-btn");
    if(logoutBtn) logoutBtn.addEventListener("click", handleLogout);

    const avatarInput = document.getElementById("avatar-input");
    if(avatarInput) avatarInput.addEventListener("change", handleAvatarUpload);
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const nameInput = document.getElementById("input-name");
    const newName = nameInput.value.trim();
    if (!newName) return showToast("Name cannot be empty.", "error");

    const btn = document.getElementById("update-btn");
    const originalText = btn.innerHTML;
    btn.innerHTML = "<i class='ri-loader-4-line animate-spin'></i> Updating...";
    btn.disabled = true;

    try {
        const res = await API.put("/api/me", { name: newName });
        if (res.success) {
            showToast("Profile updated successfully!", "success");
            // Update global state and UI
            window.appState.user = res.user;
            populateProfileForm(res.user);
            LayoutManager.updateUser(res.user);
        }
    } catch (err) {
        showToast(err.message || "Failed to update profile.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Please select an image file.", "error");
    if (file.size > 5 * 1024 * 1024) return showToast("Image must be under 5MB.", "error");

    // Show loading state on image
    const profileImg = document.getElementById("profile-image");
    const originalSrc = profileImg.src;
    profileImg.style.opacity = '0.5';
    showToast("Uploading image...", "info");

    try {
        const formData = new FormData();
        formData.append("avatar", file);
        const res = await API.put("/api/me/avatar", formData, true); // true for multipart
        if (res.success) {
            showToast("Avatar updated!", "success");
            // Update global state and UI with new photo URL
            window.appState.user.photo = res.photoUrl;
            populateProfileForm(window.appState.user);
            LayoutManager.updateUser(window.appState.user);
        }
    } catch (err) {
        showToast(err.message || "Failed to upload avatar.", "error");
        profileImg.src = originalSrc; // Revert on failure
    } finally {
        profileImg.style.opacity = '1';
        e.target.value = ''; // Reset file input
    }
}

async function handleLogout() {
    try {
        await API.post("/api/auth/logout");
        window.location.href = "/login.html";
    } catch (err) {
        console.error("Logout failed", err);
        window.location.href = "/login.html"; // Force redirect anyway
    }
}

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    const colors = {
        success: "bg-green-500",
        error: "bg-red-500",
        info: "bg-ink-900"
    };
    toast.className = `${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg font-bold text-sm animate-fade-in flex items-center gap-2`;
    toast.innerHTML = `
        <i class="${type === 'success' ? 'ri-checkbox-circle-line' : type === 'error' ? 'ri-error-warning-line' : 'ri-information-line'} text-lg"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}