"""
models.py
=========
SQLAlchemy ORM models matching the clean Supabase schema after cleanup.

Final table naming convention:
  lowercase:   categories, faculties, users
  PascalCase:  Complaints, Appeals, AiRecommendations, AnalysisReports,
               Students, OtpTokens, PriorityRules, Regulations, AuditLogs
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Faculty(Base):
    __tablename__ = "faculties"

    id           = Column(Integer, primary_key=True)
    name         = Column(String, nullable=True)
    email_domain = Column(String, nullable=True)
    createdAt    = Column(DateTime(timezone=True), nullable=False)
    updatedAt    = Column(DateTime(timezone=True), nullable=False)

    categories   = relationship("Category", back_populates="faculty")


class Category(Base):
    __tablename__ = "categories"

    id          = Column(Integer, primary_key=True)
    faculty_id  = Column(Integer, ForeignKey("faculties.id"), nullable=True)
    name        = Column(String, nullable=True)
    description = Column(String, nullable=True)
    sla_hours   = Column(Integer, nullable=True)
    is_active   = Column(Boolean, nullable=True)
    createdAt   = Column(DateTime(timezone=True), nullable=False)
    updatedAt   = Column(DateTime(timezone=True), nullable=False)
    deleted_at  = Column(DateTime(timezone=True), nullable=True)

    faculty          = relationship("Faculty", back_populates="categories")
    complaints       = relationship("Complaint", back_populates="category")
    recommendations  = relationship("AiRecommendation", back_populates="category")
    analysis_reports = relationship("AnalysisReport", back_populates="category")


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    student_id    = Column(Integer, nullable=True)
    full_name     = Column(String, nullable=True)
    email         = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    role          = Column(String, nullable=False)
    is_active     = Column(Boolean, nullable=True)
    createdAt     = Column(DateTime(timezone=True), nullable=False)
    updatedAt     = Column(DateTime(timezone=True), nullable=False)
    deletedAt     = Column(DateTime(timezone=True), nullable=True)

    complaints    = relationship("Complaint", back_populates="user")


class Complaint(Base):
    __tablename__ = "Complaints"

    id              = Column(Integer, primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id     = Column(Integer, ForeignKey("categories.id"), nullable=False)
    problem         = Column(Text, nullable=True)
    location        = Column(String, nullable=True)
    since           = Column(DateTime(timezone=True), nullable=True)
    ai_summary      = Column(Text, nullable=True)
    priority        = Column(Integer, nullable=True)
    status          = Column(String, nullable=True)
    resolution_text = Column(Text, nullable=True)
    resolved_at     = Column(DateTime(timezone=True), nullable=True)
    sla_deadline    = Column(DateTime(timezone=True), nullable=True)
    createdAt       = Column(DateTime(timezone=True), nullable=False)
    updatedAt       = Column(DateTime(timezone=True), nullable=False)

    user            = relationship("User", back_populates="complaints")
    category        = relationship("Category", back_populates="complaints")
    appeals         = relationship("Appeal", back_populates="complaint")


class Appeal(Base):
    __tablename__ = "Appeals"

    id            = Column(Integer, primary_key=True)
    complaint_id  = Column(Integer, ForeignKey("Complaints.id"), nullable=False)
    responded_by  = Column(Integer, nullable=True)
    reason        = Column(Text, nullable=True)
    status        = Column(String, nullable=True)
    response_text = Column(Text, nullable=True)
    responded_at  = Column(DateTime(timezone=True), nullable=True)
    createdAt     = Column(DateTime(timezone=True), nullable=False)
    updatedAt     = Column(DateTime(timezone=True), nullable=False)

    complaint     = relationship("Complaint", back_populates="appeals")


class AiRecommendation(Base):
    __tablename__ = "AiRecommendations"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    category_id      = Column(Integer, ForeignKey("categories.id"), nullable=False)
    pattern_detected = Column(Text, nullable=True)
    recommendation   = Column(Text, nullable=True)
    root_cause       = Column(Text, nullable=True)
    urgency          = Column(Text, nullable=True)
    estimated_impact = Column(Text, nullable=True)
    location         = Column(Text, nullable=True)
    complaint_count  = Column(Integer, nullable=True)
    avg_resolution_h = Column(Integer, nullable=True)
    appeal_rate_pct  = Column(Integer, nullable=True)
    top_keywords     = Column(Text, nullable=True)
    status           = Column(String, nullable=True, default="pending")
    createdAt        = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updatedAt        = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    generated_at     = Column(DateTime(timezone=True), nullable=True)  # added in cleanup SQL

    category         = relationship("Category", back_populates="recommendations")

    @property
    def category_name(self):
        return self.category.name if self.category else "General"



class AnalysisReport(Base):
    __tablename__ = "AnalysisReports"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    category_id  = Column(Integer, ForeignKey("categories.id"), nullable=False)
    top_issues   = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), nullable=True, default=datetime.utcnow)
    updatedAt    = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    category     = relationship("Category", back_populates="analysis_reports")


