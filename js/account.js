/* Account Profile Interactions */
document.addEventListener("DOMContentLoaded", () => {
  const editProfileBtn = document.getElementById("editProfileBtn");
  const nameInput = document.getElementById("profileNameInput");
  const emailInput = document.getElementById("profileEmailInput");
  const alertArea = document.getElementById("alertArea");
  const alertMessage = document.getElementById("alertMessage");
  
  const tfaBtn = document.getElementById("tfaBtn");
  const tfaStatus = document.getElementById("tfaStatus");
  const updatePasswordBtn = document.getElementById("updatePasswordBtn");

  // Helper: Display Alert Banner
  const showAlert = (message, isWarning = false) => {
    if (alertArea && alertMessage) {
      alertMessage.textContent = message;
      alertArea.classList.remove("hidden");
      
      if (isWarning) {
        alertArea.classList.add("border-error/40", "text-error");
        alertArea.classList.remove("border-primary/20", "text-primary");
      } else {
        alertArea.classList.add("border-primary/20", "text-primary");
        alertArea.classList.remove("border-error/40", "text-error");
      }
      
      // Auto dismiss after 3 seconds
      setTimeout(() => {
        alertArea.classList.add("hidden");
      }, 3500);
    }
  };

  // 1. Profile Field Edit Toggle
  if (editProfileBtn && nameInput && emailInput) {
    editProfileBtn.addEventListener("click", () => {
      const isReadOnly = nameInput.hasAttribute("readonly");
      
      if (isReadOnly) {
        // Toggle Edit Mode ON
        nameInput.removeAttribute("readonly");
        emailInput.removeAttribute("readonly");
        
        nameInput.focus();
        nameInput.classList.add("ring-1", "ring-primary/50");
        emailInput.classList.add("ring-1", "ring-primary/50");
        
        editProfileBtn.textContent = "Save";
        editProfileBtn.classList.add("text-primary-fixed");
      } else {
        // Toggle Edit Mode OFF (Save Details)
        nameInput.setAttribute("readonly", "");
        emailInput.setAttribute("readonly", "");
        
        nameInput.classList.remove("ring-1", "ring-primary/50");
        emailInput.classList.remove("ring-1", "ring-primary/50");
        
        editProfileBtn.textContent = "Edit";
        editProfileBtn.classList.remove("text-primary-fixed");
        
        // Show Success Alert
        showAlert(`Core profile synchronized. User ID is active under ${nameInput.value}.`);
      }
    });
  }

  // 2. Two-Factor Authentication Simulated Toggle
  if (tfaBtn && tfaStatus) {
    tfaBtn.addEventListener("click", () => {
      const isCurrentlyEnabled = tfaStatus.textContent === "Enabled";
      
      if (isCurrentlyEnabled) {
        tfaStatus.textContent = "Disabled";
        tfaStatus.classList.remove("text-primary");
        tfaBtn.textContent = "Enable";
        showAlert("Two-Factor Authentication offline.", true);
      } else {
        tfaStatus.textContent = "Enabled";
        tfaStatus.classList.add("text-primary");
        tfaBtn.textContent = "Disable";
        showAlert("Two-Factor Authentication secured via connected Signal ID.");
      }
    });
  }

  // 3. Security Updates Trigger
  if (updatePasswordBtn) {
    updatePasswordBtn.addEventListener("click", () => {
      showAlert("Authorization token sent to connection link. Check your inbox.");
    });
  }
});
