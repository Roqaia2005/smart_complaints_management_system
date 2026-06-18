const {
    getDepartmentComplaintsService,
    getComplaintDetailsService,
    updateComplaintStatusService,
    getAppealedComplaintsService,
    markAppealReviewedService
} = require('../services/officer.service');

// 1. Get Department (Category) Complaints
exports.getDepartmentComplaintsController = async (req, res) => {
    try {
        const { category_id } = req.query;

        if (!category_id) {
            return res.status(400).json({
                success: false,
                error: 'category_id is required'
            });
        }

        const data = await getDepartmentComplaintsService(category_id);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 2. Get Complaint Details
exports.getComplaintDetailsController = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await getComplaintDetailsService(id);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 3. Update Complaint Status
exports.updateComplaintStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution_text } = req.body;

        const data = await updateComplaintStatusService(id, status, resolution_text);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// 4. Get Appealed Complaints
exports.getAppealedComplaintsController = async (req, res) => {
    try {
        const { category_id } = req.query;

        if (!category_id) {
            return res.status(400).json({
                success: false,
                error: 'category_id is required'
            });
        }

        const data = await getAppealedComplaintsService(category_id);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 5. Mark Appeal as Reviewed
exports.markAppealReviewedController = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await markAppealReviewedService(id);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};