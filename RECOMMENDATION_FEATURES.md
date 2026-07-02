# Recommendation Service Features

This document summarizes the recommendation and DSS features currently implemented in the AI recommendation service.

## Overview

The recommendation service is a FastAPI-based module that helps managers understand complaint trends, identify risks, and receive AI-assisted recommendations for operational action.

## Core Features

### 1. AI Recommendation Generation
- Generates recommendations from complaint analytics and category trends.
- Uses complaint history, category signals, and risk patterns to produce actionable suggestions.
- Supports manager-facing recommendation workflows.

### 2. DSS Analytics Dashboard
- Provides overall complaint dashboard metrics.
- Calculates operational risk levels and summary insights.
- Supports risk ranking by category.

### 3. Executive Briefing Experience
- Produces a deterministic executive briefing instead of a conversational podcast-style assistant.
- Presents structured briefing sections such as:
  - introduction
  - executive summary
  - KPI summary
  - risk overview
  - alerts
  - recommendations
  - closing
- Designed for fast manager review and audio playback.

### 4. Faculty-Based Data Isolation
- Recommendations and analytics are scoped by faculty.
- Managers can only see recommendations relevant to their own faculty.
- Prevents cross-faculty data leakage.

### 5. Caching
- Recommendation outputs are cached to reduce repeated computation.
- Cache behavior is faculty-aware so different faculties do not share stale data.

### 6. Suggested Questions and Follow-up Support
- Provides suggested questions for managers after the briefing is generated.
- Supports follow-up analysis through the assistant workflow.

### 7. Authentication and Access Control
- Protected endpoints require authentication.
- Uses JWT-based access validation.
- Enforces the correct faculty context for managers.

## API Areas

### Recommendation Endpoints
- Generate recommendations
- List recommendations for the current manager
- Update recommendation status

### DSS Endpoints
- Dashboard metrics
- Risk ranking
- Executive summary
- Alerts
- Category-specific insight views

### Assistant Endpoints
- Generate executive briefing
- Ask follow-up questions
- Session status and session lifecycle
- Speech-to-text and text-to-speech support

## Current Architecture Highlights

- FastAPI service with modular routers
- SQLAlchemy models and PostgreSQL integration
- Assistant module for briefing delivery and analytics-driven narration
- Deterministic briefing generation built from DSS snapshot data
- Optional AI/LLM integration for deeper reasoning, while retaining deterministic fallback behavior

## Benefits

- Faster decision-making for managers
- Better visibility into complaint risk patterns
- Safer faculty-scoped reporting
- More consistent executive summaries and recommendations
