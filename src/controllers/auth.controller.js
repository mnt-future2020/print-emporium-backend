import { getAuth } from "../lib/auth.js";
import { validateRequired, validatePassword } from "../utils/validation.js";

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    let validation = validateRequired(token, "Reset token");
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    validation = validatePassword(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const auth = getAuth();

    try {
      await auth.api.resetPassword({
        body: {
          token,
          newPassword,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Password reset successful",
      });
    } catch (apiError) {
      return res.status(400).json({
        success: false,
        message: apiError.message || "Invalid or expired reset token",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred",
    });
  }
};
