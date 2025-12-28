document.addEventListener('DOMContentLoaded', () => {

    // --- VARIABLES (UNTOUCHED) ---
    let isLogin = true;
    let isErrorState = false;
    let appraisalTimeout;

    // --- UI ELEMENTS ---
    const form = document.getElementById('auth-form');
    const omniVoice = document.getElementById('omni-voice');
    const formTitle = document.getElementById('form-title');
    const formSubtitle = document.getElementById('form-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const toggleText = document.getElementById('toggle-text');
    const toggleBtn = document.getElementById('toggle-btn');
    const passHint = document.getElementById('pass-hint');
    
    // --- FIELDS ---
    const nameField = document.getElementById('name-field');
    const confirmPassField = document.getElementById('confirm-password-field');
    const forgotPassLink = document.getElementById('forgot-password-link');

    // --- CONSTANT TEXTS ---
    const TEXT_DEFAULT = "Join the Omniread network. Access millions of books, track your progress, and immerse yourself in a reading experience like no other.";
    const TEXT_WARNING = "DO NOT DECEIVE ME, READER. VERIFY YOURSELF FIRST.";
    const TEXT_APPRAISAL = "That is better, Reader. Proceed.";
    const TEXT_STRANGER = "You are a stranger to these archives. You do not belong to this place... yet. Who are you?";

    // --- 1. TOGGLE MODE LOGIC (UNTOUCHED) ---
    window.toggleMode = function() {
        isLogin = !isLogin;
        resetValidationStyles();
        resetVoice();
        removeGlowEffect(); 

        if (isLogin) {
            formTitle.innerText = "Welcome Back";
            formSubtitle.innerText = "Enter your credentials to access your library.";
            nameField.classList.add('hidden');
            confirmPassField.classList.add('hidden');
            forgotPassLink.classList.remove('hidden');
            passHint.classList.add('hidden');
            submitBtn.innerText = "Sign In to Omniread";
            toggleText.innerText = "Don't have an account?";
            toggleBtn.innerText = "Create one";
        } else {
            formTitle.innerText = "Create Account";
            formSubtitle.innerText = "Join the future of reading today.";
            nameField.classList.remove('hidden');
            confirmPassField.classList.remove('hidden');
            forgotPassLink.classList.add('hidden');
            passHint.classList.remove('hidden');
            submitBtn.innerText = "Create Free Account";
            toggleText.innerText = "Already have an account?";
            toggleBtn.innerText = "Sign In";
        }
    };

    // --- 2. PASSWORD TOGGLE LOGIC (UNTOUCHED) ---
    window.togglePasswordVisibility = function(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove('ri-lock-line');
            icon.classList.add('ri-lock-unlock-line');
        } else {
            input.type = "password";
            icon.classList.remove('ri-lock-unlock-line');
            icon.classList.add('ri-lock-line');
        }
    };

    // --- 3. THE OMNI VOICE LOGIC (UNTOUCHED) ---
    // --- 3. THE OMNI VOICE LOGIC (UPDATED FOR MOBILE) ---
    const omniVoiceMobile = document.getElementById('omni-voice-mobile'); // NEW

    function updateVoice(text, className, mobileText = null) {
        // Desktop Update
        if(omniVoice) {
            omniVoice.innerHTML = text;
            omniVoice.className = className;
        }
        // Mobile Update (Simplified text to save space)
        if(omniVoiceMobile) {
            omniVoiceMobile.innerHTML = mobileText || text; // Use simplified if provided
            // Map desktop classes to mobile simplified classes
            if (className.includes('text-drama')) omniVoiceMobile.className = "text-xs text-red-500 font-bold font-serif italic mb-4 animate-pulse";
            else if (className.includes('text-appraisal')) omniVoiceMobile.className = "text-xs text-green-500 font-bold font-serif mb-4";
            else omniVoiceMobile.className = "text-xs text-gray-400 font-serif italic mb-4";
        }
    }

    function setVoiceWarning(customText) {
        isErrorState = true;
        updateVoice(
            customText || TEXT_WARNING, 
            "text-drama text-lg leading-relaxed min-h-[80px]",
            customText || "⚠️ " + TEXT_WARNING
        );
    }

    function setVoiceStranger() {
        isErrorState = true;
        const desktopHTML = `${TEXT_STRANGER} <br/><span class="text-appraisal text-base mt-2 block">Why not become a part of us?</span>`;
        updateVoice(desktopHTML, "text-drama text-lg leading-relaxed min-h-[80px]", "⚠️ " + TEXT_STRANGER);
        addGlowEffect();
    }

    function setVoiceAppraisal() {
        if (!isErrorState) return;
        updateVoice(TEXT_APPRAISAL, "text-appraisal text-lg leading-relaxed min-h-[80px]", "✅ " + TEXT_APPRAISAL);
        removeGlowEffect();

        if (appraisalTimeout) clearTimeout(appraisalTimeout);
        appraisalTimeout = setTimeout(() => {
            resetVoice();
        }, 2000);
    }

    function resetVoice() {
        isErrorState = false;
        updateVoice(TEXT_DEFAULT, "text-default text-lg leading-relaxed min-h-[80px]", "");
    }

    // --- GLOW EFFECT LOGIC (UNTOUCHED) ---
    function addGlowEffect() {
        toggleBtn.classList.remove('underline', 'decoration-2', 'decoration-transparent', 'hover:decoration-vermilion');
        toggleBtn.classList.add('animate-pulse', 'text-xl', 'text-vermilion', 'drop-shadow-lg', 'no-underline');
        toggleBtn.parentElement.classList.add('animate-bounce');
        setTimeout(() => toggleBtn.parentElement.classList.remove('animate-bounce'), 1000);
    }

    function removeGlowEffect() {
        toggleBtn.classList.remove('animate-pulse', 'text-xl', 'text-vermilion', 'drop-shadow-lg', 'no-underline');
        toggleBtn.classList.add('underline', 'decoration-2', 'decoration-transparent', 'hover:decoration-vermilion');
    }

    // --- 4. MANUAL AUTH FETCH LOGIC (UNTOUCHED) ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        resetValidationStyles();
        removeGlowEffect();

        let isValid = true;
        let inputsToCheck = [];

        const emailIn = document.getElementById('input-email');
        const passIn = document.getElementById('input-password');
        inputsToCheck.push(emailIn, passIn);

        if (!isLogin) {
            const nameIn = document.getElementById('input-name');
            const confirmIn = document.getElementById('input-confirm-password');
            inputsToCheck.push(nameIn, confirmIn);
        }

        inputsToCheck.forEach(input => {
            if (!input.value.trim()) {
                triggerInputError(input);
                isValid = false;
            }
        });

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailIn.value.trim() && !emailRegex.test(emailIn.value.trim())) {
            triggerInputError(emailIn);
            setVoiceWarning("THAT DOES NOT LOOK LIKE AN EMAIL. TRY AGAIN.");
            return;
        }

        if (!isLogin) {
            const passRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
            if (passIn.value.trim() && !passRegex.test(passIn.value.trim())) {
                triggerInputError(passIn);
                setVoiceWarning("WEAK CREDENTIALS DETECTED. STRENGTHEN THEM.");
                return;
            }
        }

        if (!isLogin && isValid) {
            const pass = document.getElementById('input-password');
            const confirm = document.getElementById('input-confirm-password');
            if (pass.value !== confirm.value) {
                triggerInputError(pass);
                triggerInputError(confirm);
                setVoiceWarning("YOUR CREDENTIALS DO NOT ALIGN. RE-CALIBRATE.");
                return;
            }
        }

        if (isValid) {
            const originalText = submitBtn.innerText;
            submitBtn.innerText = "Verifying with Omni Network...";
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-wait');

            try {
                const nameVal = document.getElementById('input-name').value; 
                const endpoint = isLogin ? '/api/login' : '/api/signup';
                
                const payload = {
                    email: emailIn.value,
                    password: passIn.value
                };
                if (!isLogin) payload.name = nameVal;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    window.location.href = '/dashboard';
                } else {
                    if (isLogin) {
                        if (response.status === 404) {
                            setVoiceStranger();
                        } else {
                            setVoiceWarning(data.message || "ACCESS DENIED.");
                        }
                    } else {
                        throw new Error(data.message || "Access Denied");
                    }
                    
                    submitBtn.innerText = originalText;
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-75', 'cursor-wait');
                }

            } catch (error) {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-wait');
                setVoiceWarning(error.message || "CONNECTION ERROR. SYSTEM UNREACHABLE.");
            }
        } else {
            setVoiceWarning(TEXT_WARNING);
        }
    });

    // --- 5. GOOGLE AUTH INITIALIZATION (THE FIX) ---
    function initGoogleAuth() {
        const wrapper = document.getElementById("google-btn-wrapper");
        
        // Wait for Google Script + Element to be ready
        if (window.google && window.google.accounts && wrapper) {
            
            google.accounts.id.initialize({
                client_id: "108260889900-hlch8lj2qlsjdfr40slqthhtni9218v8.apps.googleusercontent.com", 
                callback: handleGoogleResponse
            });

            // Calculate exact width to ensure the invisible button covers your UI
            const containerWidth = wrapper.parentElement.offsetWidth || 200;

            google.accounts.id.renderButton(
                wrapper,
                { 
                    theme: "outline", 
                    size: "large", 
                    width: containerWidth // [CRITICAL] Forces button to fill the box
                } 
            );
            console.log("OmniRead: Google Identity Hooked.");
        } else {
            // Retry if script isn't loaded yet
            setTimeout(initGoogleAuth, 200);
        }
    }

    // Call Immediately
    initGoogleAuth();

    // [FIXED] HANDLE GOOGLE RESPONSE
    async function handleGoogleResponse(response) {
        const googleToken = response.credential;
        submitBtn.innerText = "Verifying Google Identity...";
        submitBtn.disabled = true;

        try {
            const apiRes = await fetch('/api/google-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: googleToken })
            });

            const data = await apiRes.json();

            if (apiRes.ok && data.success) {
                window.location.href = '/dashboard';
            } else {
                console.error("Server Error:", data); 
                setVoiceWarning(data.message || "VERIFICATION FAILED");
                submitBtn.innerText = isLogin ? "Sign In to Omniread" : "Create Free Account";
                submitBtn.disabled = false;
            }
        } catch (error) {
            setVoiceWarning("CONNECTION ERROR: " + error.message);
            console.error(error);
            submitBtn.innerText = isLogin ? "Sign In to Omniread" : "Create Free Account";
            submitBtn.disabled = false;
        }
    }

    // --- HELPERS (UNTOUCHED) ---
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            const group = input.closest('.relative');
            const icon = group.querySelector('.input-icon');
            if(icon) {
                icon.classList.remove('icon-error');
                icon.classList.add('text-gray-500', 'group-focus-within:text-brand-cyan');
            }
            if (isErrorState) {
                setVoiceAppraisal();
            }
        });
    });

    function triggerInputError(inputElement) {
        inputElement.classList.add('input-error');
        const group = inputElement.closest('.relative');
        const icon = group.querySelector('.input-icon');
        if(icon) {
            icon.classList.add('icon-error');
            icon.classList.remove('text-gray-500', 'group-focus-within:text-brand-cyan');
        }
    }

    function resetValidationStyles() {
        document.querySelectorAll('input').forEach(input => {
            input.classList.remove('input-error');
        });
        document.querySelectorAll('.input-icon').forEach(icon => {
            icon.classList.remove('icon-error');
            icon.classList.add('text-gray-500', 'group-focus-within:text-brand-cyan');
        });
    }

    if(isLogin) {
        passHint.classList.add('hidden');
    }
});