const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    
    const hasDirectRole = allowedRoles.includes(req.user.role);
    // An officer flagged as also-manager passes any check that allows 'manager'
    const hasManagerOverride =
      allowedRoles.includes("manager") &&
      req.user.role === "officer" &&
      req.user.is_also_manager === true;

    if (!hasDirectRole && !hasManagerOverride) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

// شorthands جاهزة للاستخدام في الـ routes
const isSuperAdmin = authorize("super_admin");
const isAdmin = authorize("admin", "super_admin");
const isManager = authorize("manager", "admin", "super_admin");
const isOfficer = authorize("officer", "manager", "admin", "super_admin");

module.exports = { authorize, isSuperAdmin, isAdmin, isManager, isOfficer };