import { useEffect, useState } from "react";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { getOffensiveMessages, getApiErrorMessage, type OffensiveMessage } from "@/api/adminApi";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  LoadingState,
  Banner,
} from "./adminUi";

export default function OffensiveMessagesPage() {
  const [messages, setMessages] = useState<OffensiveMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getOffensiveMessages();
      setMessages(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load offensive messages."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Offensive Messages"
        description="Review chatbot interaction logs flagged for offensive language by the system guardrails."
      />

      {error && <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>}

      <Card>
        {loading ? (
          <LoadingState label="Loading offensive logs…" />
        ) : messages.length === 0 ? (
          <EmptyState title="No flagged messages" description="No offensive language incidents have been logged yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Session ID</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Offense Count</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id} className="border-b border-border last:border-0 hover:bg-muted/40 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-foreground">{msg.user_name || "Unknown User"}</div>
                      <div className="text-xs text-muted-foreground">{msg.email}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      #{msg.session_id}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-md break-words">
                      "{msg.message}"
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={msg.offense_count >= 2 ? "destructive" : "accent"}>
                        {msg.offense_count} / 2
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(msg.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
