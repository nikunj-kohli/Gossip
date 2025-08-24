const Report = require('../models/Report');
const ContentFilter = require('../utils/contentFilter');

// Submit a report
exports.submitReport = async (req, res) => {
  try {
    const { entityType, entityId, reason, details } = req.body;
    const reporterId = req.user.id;
    
    // Validate entity type
    const validEntityTypes = ['post', 'comment', 'user'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entity type' });
    }
    
    // Validate reason
    const validReasons = [
      'spam', 'harassment', 'hate_speech', 'violence', 
      'illegal_content', 'misinformation', 'other'
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ message: 'Invalid reason' });
    }
    
    // Create report
    const report = await Report.create({
      reporterId,
      entityType,
      entityId,
      reason,
      details: details || null
    });
    
    return res.status(201).json({
      message: 'Report submitted successfully',
      report
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get reports (admin only)
exports.getReports = async (req, res) => {
  try {
    const { status, entityType, limit, offset, sortBy, sortOrder } = req.query;
    
    const options = {
      status: status || null,
      entityType: entityType || null,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'DESC'
    };
    
    const reports = await Report.getAll(options);
    
    return res.status(200).json(reports);
  } catch (error) {
    console.error('Error getting reports:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get report by ID (admin only)
exports.getReportById = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const report = await Report.findById(reportId);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    return res.status(200).json(report);
  } catch (error) {
    console.error('Error getting report:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Update report status (admin only)
exports.updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, notes } = req.body;
    const moderatorId = req.user.id;
    
    // Validate status
    const validStatuses = ['pending', 'reviewed', 'actioned', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const updatedReport = await Report.updateStatus(
      reportId,
      status,
      moderatorId,
      notes
    );
    
    return res.status(200).json({
      message: 'Report status updated successfully',
      report: updatedReport
    });
  } catch (error) {
    console.error('Error updating report status:', error);
    
    if (error.message === 'Report not found') {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get reports for an entity (admin only)
exports.getReportsForEntity = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    // Validate entity type
    const validEntityTypes = ['post', 'comment', 'user'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entity type' });
    }
    
    const reports = await Report.getByEntity(entityType, entityId);
    
    return res.status(200).json(reports);
  } catch (error) {
    console.error('Error getting reports for entity:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get report counts (admin only)
exports.getReportCounts = async (req, res) => {
  try {
    const counts = await Report.getCounts();
    
    return res.status(200).json(counts);
  } catch (error) {
    console.error('Error getting report counts:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Check content against automated filters
exports.checkContent = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }
    
    const result = await ContentFilter.filterContent(content, {
      useKeywords: true,
      usePatterns: true,
      useExternalAPI: false, // Set to true if you have an external API configured
      threshold: 1
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error checking content:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};