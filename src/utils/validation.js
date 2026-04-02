export const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === "string" && value.trim().length === 0)) {
    return {
      isValid: false,
      error: `${fieldName} is required and cannot be empty`,
    };
  }
  return { isValid: true };
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: "Please provide a valid email address",
    };
  }
  return { isValid: true };
};

export const validatePassword = (password) => {
  const validation = validateRequired(password, "Password");
  if (!validation.isValid) return validation;

  if (password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters long",
    };
  }

  return { isValid: true };
};

export const validateUrl = (url) => {
  try {
    new URL(url);
    return { isValid: true };
  } catch (e) {
    return {
      isValid: false,
      error: "Please provide a valid URL",
    };
  }
};

export const validatePhone = (phone) => {
  // Basic phone validation
  const phoneRegex = /^[0-9\+\-\s\(\)]{10,}$/;
  if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
    return {
      isValid: false,
      error: "Please provide a valid phone number",
    };
  }
  return { isValid: true };
};

export const validateRequiredFields = (data, requiredFields) => {
  const missingFields = [];
  for (const field of requiredFields) {
    const value = data[field];
    if (!value || (typeof value === "string" && value.trim().length === 0)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      isValid: false,
      error: `Missing required fields: ${missingFields.join(", ")}`,
      missingFields,
    };
  }

  return { isValid: true };
};
