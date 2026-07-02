import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Search,
  ChevronRight,
  Clock,
  CheckCircle2,
  MessageCircle,
  AlertTriangle,
  Loader2,
  Plus,
  MapPin,
  Calendar,
  X,
} from "lucide-react";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import type { ComplaintStatus } from "../../types/workflow";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { studentApi } from "../../api/services";

const statusMap: Record<
  ComplaintStatus,
  { label: string; color: string; icon: any }
> = {
  pending: {
    label: "Pending",
    color:
      "bg-slate-500/15 text-slate-500 border-slate-500/20 dark:text-slate-400",
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-500/15 text-blue-500 border-blue-500/20 dark:text-blue-400",
    icon: MessageCircle,
  },
  resolved: {
    label: "Resolved",
    color:
      "bg-emerald-500/15 text-emerald-500 border-emerald-500/20 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  appealed: {
    label: "Appealed",
    color:
      "bg-orange-500/15 text-orange-500 border-orange-500/20 dark:text-orange-400",
    icon: AlertTriangle,
  },
};

interface BackendComplaint {
  id: number;
  user_id: number;
  category_id: number;
  problem: string;
  location: string;
  since: string;
  ai_summary: string;
  priority: number;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  Category?: {
    name: string;
  };
}

interface BackendCategory {
  id: number;
  name: string;
  description?: string;
  sla_hours?: number;
}

export default function StudentComplaints() {
  const { user } = useAuthStore();
  const [complaints, setComplaints] = React.useState<BackendComplaint[]>([]);
  const [categories, setCategories] = React.useState<BackendCategory[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"latest" | "oldest">("latest");

  // Submit Complaint Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [problem, setProblem] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [sinceDate, setSinceDate] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const fetchComplaintsAndCategories = React.useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const studentUserId =
        typeof user.id === "string" ? parseInt(user.id, 10) : user.id;
      const [complaintsRes, categoriesRes] = await Promise.all([
        studentApi.getMyComplaints(studentUserId),
        studentApi.getCategories(),
      ]);
      setComplaints(complaintsRes.data.complaints || []);
      setCategories(categoriesRes.data.categories || []);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch your complaints. Please reload the page.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    fetchComplaintsAndCategories();
  }, [fetchComplaintsAndCategories]);

  // Handle Manual Submission
  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!categoryId || !problem || !location || !sinceDate) {
      setSubmitError("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const studentUserId =
        typeof user.id === "string" ? parseInt(user.id, 10) : user.id;
      await studentApi.submitComplaint({
        user_id: studentUserId,
        category_id: parseInt(categoryId, 10),
        problem,
        location,
        since: new Date(sinceDate).toISOString(),
      } as any);

      // Reset form & reload
      setCategoryId("");
      setProblem("");
      setLocation("");
      setSinceDate("");
      setIsModalOpen(false);
      fetchComplaintsAndCategories();
    } catch (err: any) {
      console.error(err);
      setSubmitError(
        err.response?.data?.message ||
          "Failed to submit complaint. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter and sort complaints
  const filteredComplaints = React.useMemo(() => {
    let result = [...complaints];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Search term
    if (searchTerm.trim() !== "") {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.problem.toLowerCase().includes(searchLower) ||
          (c.Category?.name &&
            c.Category.name.toLowerCase().includes(searchLower)) ||
          c.id.toString().includes(searchLower),
      );
    }

    // Sort
    result.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortBy === "latest" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [complaints, statusFilter, searchTerm, sortBy]);

  // Statistics
  const stats = React.useMemo(() => {
    const counts = { pending: 0, in_progress: 0, resolved: 0, appealed: 0 };
    complaints.forEach((c) => {
      if (c.status in counts) {
        counts[c.status]++;
      }
    });
    return counts;
  }, [complaints]);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            My Complaints
          </h1>
          <p className="text-slate-500 font-medium">
            Track the status of your submitted issues or submit a new one
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/student/chat">
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20 text-white font-semibold">
              <MessageCircle size={18} /> Listen to brief summary
            </Button>
          </Link>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
            className="gap-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
          >
            <Plus size={18} /> Submit Manually
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium mt-4">
            Loading your complaints...
          </p>
        </div>
      ) : error ? (
        <Card className="border-red-200 dark:border-red-900 bg-red-500/5 p-6 text-center max-w-lg mx-auto">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">
            Error Occurred
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            {error}
          </p>
          <Button
            onClick={fetchComplaintsAndCategories}
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </Card>
      ) : (
        <>
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl">
            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={18}
                />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search complaints by ID, category, or problem..."
                  className="pl-10 h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  {[
                    "all",
                    "pending",
                    "in_progress",
                    "resolved",
                    "appealed",
                  ].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-md transition-colors capitalize",
                        statusFilter === status
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                      )}
                    >
                      {status === "in_progress" ? "In Progress" : status}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSortBy((prev) =>
                      prev === "latest" ? "oldest" : "latest",
                    )
                  }
                  className="h-10 border-slate-200 dark:border-slate-800 font-semibold"
                >
                  {sortBy === "latest" ? "Latest First" : "Oldest First"}
                </Button>
              </div>
            </div>

            <CardContent className="p-0">
              {filteredComplaints.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <p className="font-medium text-lg">No complaints found</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Try adjusting your filters or search term
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredComplaints.map((complaint) => {
                    const status = statusMap[complaint.status] || {
                      label: complaint.status,
                      color: "bg-slate-500/10 text-slate-500",
                      icon: Clock,
                    };
                    return (
                      <Link
                        key={complaint.id}
                        to={`/student/complaints/${complaint.id}`}
                        className="flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-4 text-slate-400 font-mono text-xs border border-slate-200/50 dark:border-slate-700/50">
                          #{complaint.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                            {complaint.problem
                              .split("\n")[0]
                              .substring(0, 80) || "No description"}
                          </h3>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-medium">
                            <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {complaint.Category?.name || "Unassigned"}
                            </span>
                            <span>•</span>
                            <span>
                              Submitted on{" "}
                              {new Date(
                                complaint.createdAt,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 ml-4">
                          <Badge
                            className={cn(
                              "px-3 py-1 font-bold flex items-center gap-1 border",
                              status.color,
                            )}
                          >
                            <status.icon size={12} />
                            {status.label}
                          </Badge>
                          <ChevronRight
                            size={20}
                            className="text-slate-300 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors"
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                label: "Pending",
                value: stats.pending,
                color: "bg-slate-500",
                border: "border-slate-500/20",
              },
              {
                label: "In Progress",
                value: stats.in_progress,
                color: "bg-blue-500",
                border: "border-blue-500/20",
              },
              {
                label: "Resolved",
                value: stats.resolved,
                color: "bg-emerald-500",
                border: "border-emerald-500/20",
              },
              {
                label: "Appealed",
                value: stats.appealed,
                color: "bg-orange-500",
                border: "border-orange-500/20",
              },
            ].map((stat) => (
              <Card
                key={stat.label}
                className={cn(
                  "border bg-white dark:bg-slate-900/50 shadow-sm",
                  stat.border,
                )}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={cn("w-2.5 h-12 rounded-full", stat.color)} />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {stat.label}
                    </p>
                    <h4 className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                      {stat.value}
                    </h4>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Manual Complaint Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-white">
                  Submit New Complaint
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 mt-1">
                  Please enter the details of the issue you are experiencing.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </Button>
            </CardHeader>
            <form onSubmit={handleSubmitComplaint}>
              <CardContent className="space-y-4 pt-6">
                {submitError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Complaint Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-blue-600 outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Problem Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    required
                    placeholder="Describe your issue in detail..."
                    className="w-full min-h-[120px] p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 text-sm focus:ring-2 focus:ring-blue-600 outline-none text-slate-800 dark:text-slate-200 resize-none animate-in"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <MapPin size={14} className="text-slate-400" />
                      Location <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                      placeholder="e.g. Building B, Room 102"
                      className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Calendar size={14} className="text-slate-400" />
                      Happening Since <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="datetime-local"
                      value={sinceDate}
                      onChange={(e) => setSinceDate(e.target.value)}
                      required
                      className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-lg shadow-blue-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Complaint"
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
