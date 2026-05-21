/* Authentication View Interactions */
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");
  const visibilityIcon = document.getElementById("visibilityIcon");

  // 1. Password Visibility Toggle
  if (togglePasswordBtn && passwordInput && visibilityIcon) {
    togglePasswordBtn.addEventListener("click", () => {
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        visibilityIcon.textContent = "visibility_off";
      } else {
        passwordInput.type = "password";
        visibilityIcon.textContent = "visibility";
      }
    });
  }

  // 2. Simulated Hardware Session Engagement with Strict Form Validation
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById("email");
      const emailError = document.getElementById("emailError");
      const passwordError = document.getElementById("passwordError");
      
      const emailVal = emailInput.value.trim();
      const passVal = passwordInput.value;
      
      // A. Standard Email Regex Validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmailValid = emailRegex.test(emailVal);
      
      // B. Standard Secure Password Strength Validation
      // Requirements: 8+ chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
      const hasMinLength = passVal.length >= 8;
      const hasUppercase = /[A-Z]/.test(passVal);
      const hasLowercase = /[a-z]/.test(passVal);
      const hasDigit = /[0-9]/.test(passVal);
      const hasSpecial = /[^A-Za-z0-9]/.test(passVal);
      
      const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSpecial;
      
      // Update UI error feedback states
      let hasError = false;
      
      if (!isEmailValid) {
        emailInput.classList.add("border-error");
        emailError.classList.remove("hidden");
        hasError = true;
      } else {
        emailInput.classList.remove("border-error");
        emailError.classList.add("hidden");
      }
      
      if (!isPasswordValid) {
        passwordInput.classList.add("border-error");
        passwordError.classList.remove("hidden");
        hasError = true;
      } else {
        passwordInput.classList.remove("border-error");
        passwordError.classList.add("hidden");
      }
      
      // If validation fails, abort submission
      if (hasError) return;
      
      const submitBtn = loginForm.querySelector("button[type='submit']");
      const submitSpan = submitBtn.querySelector("span");
      const originalText = submitSpan.textContent;
      
      // Visual feedback - simulated hardware authorization sequence
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-90");
      submitSpan.textContent = "Initializing Core...";
      
      // Play a quick satisfying hover/click feel via visual state
      setTimeout(() => {
        submitSpan.textContent = "Authorizing Node...";
        
        setTimeout(() => {
          // Success sequence, redirect to projects dashboard
          window.location.href = "dashboard.html";
        }, 600);
      }, 500);
    });
  }
});
