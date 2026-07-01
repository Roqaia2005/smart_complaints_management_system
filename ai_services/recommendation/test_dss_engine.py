import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
import unittest

import dss_analytics

class TestDSSEngine(unittest.TestCase):

    def setUp(self):
        # Create standard mock data matching schema
        base_time = datetime.utcnow()
        
        # We need a DataFrame representing complaints for category 1
        # It needs columns:
        # 'id', 'problem', 'ai_summary', 'priority', 'status', 'createdAt', 'resolved_at', 'location', 'category_id', 'category_name', 'has_appeal', 'is_high_priority', 'day_of_week', 'month', 'resolution_hours'
        
        rows = []
        # Let's generate 20 complaints for category 1
        # High unresolved ratio, some appeals, some high priorities, etc.
        for i in range(20):
            created_at = base_time - timedelta(days=i)
            # resolved or not
            if i % 3 == 0:
                status = "resolved"
                resolved_at = created_at + timedelta(hours=24)
                resolution_hours = 24.0
            else:
                status = "pending"
                resolved_at = pd.NaT
                resolution_hours = 0.0
                
            rows.append({
                "id": 100 + i,
                "problem": "Server is extremely slow and keeps timing out" if i % 2 == 0 else "Cannot access registration portal",
                "ai_summary": "System outage / slowness",
                "priority": 5 if i % 2 == 0 else 2, # priority >= 4 is high priority
                "status": status,
                "createdAt": pd.to_datetime(created_at, utc=True),
                "resolved_at": pd.to_datetime(resolved_at, utc=True) if not pd.isna(resolved_at) else pd.NaT,
                "location": "Main Campus" if i % 4 != 0 else "Engineering Block",
                "category_id": 1,
                "category_name": "IT Outage",
                "has_appeal": 1 if i % 5 == 0 else 0,
                "is_high_priority": 1 if i % 2 == 0 else 0,
                "day_of_week": created_at.strftime("%A"),
                "month": created_at.strftime("%B"),
                "resolution_hours": resolution_hours
            })
            
        self.df = pd.DataFrame(rows)
        
        # Statistics row matching compute_statistics output
        self.stats_row = {
            "category_id": 1,
            "category_name": "IT Outage",
            "complaint_count": 20,
            "avg_res_hours": 8.0,
            "appeal_rate_pct": 20.0,
            "high_priority_pct": 50.0,
            "peak_day": "Monday",
            "peak_month": "June",
            "top_location": "Main Campus"
        }

    def test_goal_1_configurable_risk_engine(self):
        """Goal 1: Risk config load and presence of all weights and thresholds"""
        config = dss_analytics.get_risk_config()
        self.assertIn("weights", config)
        self.assertIn("thresholds", config)
        self.assertIn("unresolved_ratio", config["weights"])
        self.assertIn("high_risk", config["thresholds"])
        self.assertIn("medium_risk", config["thresholds"])

    def test_goal_2_risk_breakdown(self):
        """Goal 2: Risk score computation and mathematical breakdown correctness"""
        risk_data = dss_analytics.compute_risk_score(self.df)
        self.assertIn("risk_score", risk_data)
        self.assertIn("risk_level", risk_data)
        self.assertIn("risk_breakdown", risk_data)
        
        breakdown = risk_data["risk_breakdown"]
        factors = ["unresolved_ratio", "high_priority", "appeal_rate", "aging"]
        
        calculated_sum = 0.0
        for factor in factors:
            self.assertIn(factor, breakdown)
            item = breakdown[factor]
            self.assertIn("raw_value", item)
            self.assertIn("normalized_value", item)
            self.assertIn("weight", item)
            self.assertIn("contribution", item)
            calculated_sum += item["contribution"]
            
        self.assertAlmostEqual(risk_data["risk_score"], calculated_sum, places=1)

    def test_goal_3_confidence_score_thresholds(self):
        """Goal 3: Confidence score calculations & thresholds (0-49: Low, 50-74: Medium, 75-100: High)"""
        # Let's check confidence level classification
        self.assertEqual(dss_analytics._confidence_level_from_score(45), "Low")
        self.assertEqual(dss_analytics._confidence_level_from_score(50), "Medium")
        self.assertEqual(dss_analytics._confidence_level_from_score(74), "Medium")
        self.assertEqual(dss_analytics._confidence_level_from_score(75), "High")
        self.assertEqual(dss_analytics._confidence_level_from_score(90), "High")

        keywords = ["slow", "portal", "server", "timeout"]
        score_dict = dss_analytics.compute_confidence_score(self.df, keywords, self.stats_row)
        score = score_dict["confidence_score"]
        self.assertTrue(0 <= score <= 100)

    def test_goal_4_multi_evidence_root_cause(self):
        """Goal 4: Multi-evidence root cause and list representation"""
        keywords = ["slow", "portal", "server", "timeout"]
        rca = dss_analytics.analyze_root_causes(self.df, keywords, self.stats_row)
        self.assertIn("confident_root_cause", rca)
        self.assertIn("root_cause_evidence", rca)
        self.assertIn("confidence_score", rca)
        self.assertIn("confidence_level", rca)
        
        evidence = rca["root_cause_evidence"]
        self.assertIsInstance(evidence, list)
        if len(evidence) > 0:
            for item in evidence:
                self.assertIn("type", item)
                self.assertIn("description", item)
                self.assertIn("confidence", item)

    def test_goal_5_historical_trend_analytics(self):
        """Goal 5: Historical trend calculation (30 days vs previous 30 days)"""
        risk_data = dss_analytics.compute_risk_score(self.df)
        trend_data = dss_analytics.compute_trend(self.df, risk_data)
        self.assertIn("trend", trend_data)
        self.assertIn("change_percentage", trend_data)
        self.assertIn("comparison", trend_data)
        
        self.assertIn(trend_data["trend"], ["Increasing", "Stable", "Decreasing"])
        self.assertIsInstance(trend_data["change_percentage"], (int, float))

    def test_goal_6_resolution_quality_index(self):
        """Goal 6: Resolution Quality Index (0-100 score and level)"""
        rq = dss_analytics.compute_resolution_quality(self.df, self.stats_row)
        self.assertIn("quality_score", rq)
        self.assertIn("quality_level", rq)
        self.assertTrue(0 <= rq["quality_score"] <= 100)
        self.assertIn(rq["quality_level"], ["Excellent", "Good", "Fair", "Poor"])

    def test_goal_7_location_intelligence(self):
        """Goal 7: Location intelligence returns top 3 locations"""
        loc_intel = dss_analytics.compute_location_intelligence(self.df)
        self.assertIsInstance(loc_intel, list)
        self.assertTrue(len(loc_intel) <= 3)
        for loc in loc_intel:
            self.assertIn("location", loc)
            self.assertIn("count", loc)
            self.assertIn("share_pct", loc)
            self.assertIn("classification", loc)

    def test_goal_8_temporal_intelligence(self):
        """Goal 8: Temporal intelligence weekday/weekend, spikes, etc."""
        temp_intel = dss_analytics.compute_temporal_intelligence(self.df)
        self.assertIn("weekday_weekend", temp_intel)
        self.assertIn("peak_day", temp_intel)
        self.assertIn("peak_month", temp_intel)
        # repeated_spikes is conditionally present
        if "repeated_spikes" in temp_intel:
            self.assertIsInstance(temp_intel["repeated_spikes"], list)

    def test_goal_9_evidence_package(self):
        """Goal 9: Evidence package structure"""
        keywords = ["slow", "portal", "server"]
        rca = dss_analytics.analyze_root_causes(self.df, keywords, self.stats_row)
        risk = dss_analytics.compute_risk_score(self.df)
        trend = dss_analytics.compute_trend(self.df, risk)
        prediction = dss_analytics.compute_prediction(self.df, risk["risk_score"], trend)
        confidence_data = {
            "confidence_score": rca.get("confidence_score", 0),
            "confidence_level": rca.get("confidence_level", "Low"),
        }
        
        evidence_pkg = dss_analytics.build_evidence_package(
            rca=rca,
            risk=risk,
            stats=self.stats_row,
            keywords=keywords,
            trend_data=trend,
            confidence=confidence_data,
            prediction=prediction
        )
        self.assertIn("root_cause", evidence_pkg)
        self.assertIn("root_cause_evidence", evidence_pkg)
        self.assertIn("confidence_score", evidence_pkg)
        self.assertIn("risk_score", evidence_pkg)
        self.assertIn("prediction", evidence_pkg)
        self.assertIn("supporting_metrics", evidence_pkg)

    def test_goal_10_prediction_layer(self):
        """Goal 10: 30-day prediction window only"""
        risk_data = dss_analytics.compute_risk_score(self.df)
        trend_data = dss_analytics.compute_trend(self.df, risk_data)
        pred = dss_analytics.compute_prediction(self.df, risk_data["risk_score"], trend_data)
        self.assertIn("predicted_risk", pred)
        self.assertIn("prediction_confidence", pred)
        self.assertIn("prediction_window_days", pred)
        self.assertEqual(pred["prediction_window_days"], 30)

    def test_goal_11_smarter_alerts(self):
        """Goal 11: Smarter alerts with reason and recommended_action"""
        # Create stats df and insights dict
        stats_df = pd.DataFrame([self.stats_row])
        insights = dss_analytics.build_category_insights(self.df, stats_df)
        alerts = dss_analytics.generate_smart_alerts(self.df, stats_df, insights)
        self.assertIsInstance(alerts, list)
        for alert in alerts:
            self.assertIn("severity", alert)
            self.assertIn("category_id", alert)
            self.assertIn("alert_type", alert)
            self.assertIn("message", alert)
            self.assertIn("reason", alert)
            self.assertIn("recommended_action", alert)

    def test_decision_priority_score(self):
        """Decision Priority Score (0-100 and level Critical/High/Medium/Low)"""
        dp = dss_analytics.compute_decision_priority(
            risk_score=75,
            confidence_score=80,
            complaint_count=30,
            high_priority_pct=60,
            quality_score=40
        )
        self.assertIn("score", dp)
        self.assertIn("level", dp)
        self.assertTrue(0 <= dp["score"] <= 100)
        self.assertIn(dp["level"], ["Critical", "High", "Medium", "Low"])

if __name__ == '__main__':
    unittest.main()
