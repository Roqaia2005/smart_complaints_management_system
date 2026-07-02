# Node Backend Complaint System Features

This document summarizes the features currently implemented in the Node.js backend for the complaints management system.

## Overview

The backend powers the university complaints platform and handles student submissions, officer workflows, manager analytics, and administrative configuration.

## Main Functional Areas

### 1. Student Complaint Management
- Students can submit complaints.
- Students can view their own complaint history.
- Students can view complaint details.
- Students can file appeals when dissatisfied with a resolution.
- Complaint data includes category, problem description, location, and submission details.

### 2. Officer Workflow
- Officers can view complaints assigned to their department or category.
- Officers can review complaints in AI-priority order.
- Officers can update complaint status such as in progress or resolved.
- Officers can add resolution text when closing complaints.
- Officers can review and process appeals.

### 3. Manager Analytics and Monitoring
- Managers can access complaint overview statistics.
- Managers can view department performance metrics.
- Managers can inspect complaint heatmaps by category, location, time, or department.
- Managers can access AI-generated recommendations.
- Managers can update recommendation status.
- Managers can access reports and top-issue insights.

### 4. Admin and Configuration Management
- Admins can manage complaint categories.
- Admins can manage users and roles.
- Admins can manage regulations and university rules.
- Admins can configure priority rules.
- Admins can review audit logs for system activity.
- Admins can view system insights and analytics widgets.

### 5. Authentication and Authorization
- JWT-based authentication is used across user roles.
- Role-based access is enforced for students, officers, managers, and admins.
- Protected routes ensure that users only access the data they are authorized to view.

### 6. AI and External Service Integration
- The backend integrates with the Python AI recommendation service.
- Complaint submissions can be processed through AI-assisted categorization and prioritization.
- Category and regulation updates can trigger AI-related refresh operations.

## Key Backend Capabilities

- Express.js REST API server
- Sequelize ORM with PostgreSQL support
- Role-based API routing for student, officer, manager, and admin workflows
- Complaint lifecycle management
- Appeal handling
- Reporting and analytics endpoints
- Administrative configuration tools
- Integration with Python AI microservices

## Typical User Roles

- Student: submit and track complaints
- Officer: manage assigned complaints and appeals
- Manager: monitor performance and review recommendations
- Admin: configure categories, regulations, users, and system settings

## Notes

The backend is designed as the main operational layer for the complaint system, while the recommendation service adds analytics-driven insights and executive assistant features on top of the same complaint data.
