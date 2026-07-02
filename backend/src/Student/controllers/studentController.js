const studentService = require("../services/studentService");

// 1. Submit complaint
exports.submitComplaint = async (req, res) => {
  try {
    const result = await studentService.submitNewComplaint(req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 2. Get student complaints
exports.getMyComplaints = async (req, res) => {
  try {
    const complaints = await studentService.getStudentComplaints(
      req.params.student_id,
    );
    return res.status(200).json({ complaints });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 3. Complaint details
exports.getDetails = async (req, res) => {
  try {
    const data = await studentService.getComplaintById(req.params.id);

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "الشكوى غير موجودة." });
    }

    return res.status(200).json({
      complaint: data,
      student_data: data.User ? data.User.Student : null,
      faculty: data.User?.Student?.Faculty?.name || "N/A",
      history: data.ComplaintHistories,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 4. Submit appeal
exports.submitAppeal = async (req, res) => {
  try {
    const result = await studentService.createAppeal(
      req.params.id,
      req.body.reason,
      req.body.user_id,
    );
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 5. Get categories — pass faculty_id from query so each faculty sees their own categories
exports.getCategories = async (req, res) => {
  try {
    const { faculty_id } = req.query;
    const categories = await studentService.getActiveCategories(faculty_id);
    return res.status(200).json({ categories });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
