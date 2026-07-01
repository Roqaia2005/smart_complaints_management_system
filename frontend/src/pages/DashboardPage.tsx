import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "../components/ui/card";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Zap,
  Activity,
  Sparkles,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Badge } from "../components/ui/badge";

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles size={16} /> Executive command center
            </div>
            <h1 className="text-3xl font-bold">Good morning, {user?.name}</h1>
            <p className="mt-2 text-muted-foreground">
              Your AI analyst is highlighting the most urgent risks,
              recommendations, and opportunities across the organization.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="gap-2">
              <Target size={16} /> Review priorities
            </Button>
            <Button variant="outline" className="gap-2">
              <ShieldCheck size={16} /> Risk snapshot
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "Active Requests",
            value: "12",
            icon: Activity,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Pending Approval",
            value: "5",
            icon: Clock,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
          {
            label: "Resolved Today",
            value: "28",
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Escalations",
            value: "2",
            icon: AlertCircle,
            color: "text-rose-500",
            bg: "bg-rose-500/10",
          },
        ].map((stat, index) => (
          <Card
            key={`${stat.label}-${index}`}
            className="relative overflow-hidden border-border/70 bg-card/80 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
                </div>
                <div className={cn("p-3 rounded-xl", stat.bg)}>
                  <stat.icon className={stat.color} size={24} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-500">
                <TrendingUp size={14} />
                <span>+12% from yesterday</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Track the latest updates across your workflows
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary font-semibold"
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                {
                  title: "IT Support Request #4521",
                  user: "Sarah Connor",
                  status: "In Progress",
                  time: "10 mins ago",
                  type: "Support",
                },
                {
                  title: "Invoice Approval #882",
                  user: "John Smith",
                  status: "Pending",
                  time: "25 mins ago",
                  type: "Finance",
                },
                {
                  title: "Hardware Upgrade",
                  user: "Dave Miller",
                  status: "Resolved",
                  time: "1 hour ago",
                  type: "Inventory",
                },
                {
                  title: "New Employee Onboarding",
                  user: "Emma Wilson",
                  status: "Escalated",
                  time: "2 hours ago",
                  type: "HR",
                },
              ].map((activity, index) => (
                <div
                  key={`${activity.title}-${index}`}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-xs">
                    {activity.user.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors cursor-pointer">
                      {activity.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Initiated by {activity.user} • {activity.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        activity.status === "Resolved"
                          ? "success"
                          : activity.status === "Escalated"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {activity.status}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Efficiency Insights</CardTitle>
            <CardDescription>AI-powered workflow optimizations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Zap size={16} />
                <span>Bottleneck Detected</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                "Finance Approval" step is taking 40% longer than average this
                week. Consider reassigning tasks.
              </p>
              <Button size="sm" className="w-full mt-2 h-8 text-xs">
                Analyze Workflow
              </Button>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                <CheckCircle2 size={16} />
                <span>Performance Peak</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                HR Onboarding workflow has reached 98% SLA compliance. Great
                job!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Simple helper for CN in this file if needed
import { cn } from "../lib/utils";
