exports.validateComplaint = (req, res, next) => {
  const { user_id, category_id, problem } = req.body;

  // location and since are optional — some complaint types like "Other" may not have them
  if (!user_id || !category_id || !problem) {
    return res.status(400).json({
      success: false,
      message:
        "بيانات الشكوى غير مكتملة. user_id و category_id و problem مطلوبة.",
    });
  }

  next();
};

exports.validateAppeal = (req, res, next) => {
  if (!req.body.reason) {
    return res.status(400).json({
      success: false,
      message: "سبب التظلم مطلوب.",
    });
  }

  next();
};
