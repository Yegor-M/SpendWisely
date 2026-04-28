"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Prediction } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const confidenceStyle: Record<string, string> = {
  high:   "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low:    "bg-gray-100 text-gray-600",
  "—":    "bg-blue-100 text-blue-800",
};

export function PredictionTable({ data }: { data: Prediction[] }) {
  const total = data.find((r) => r.category === "TOTAL");
  const rows = data.filter((r) => r.category !== "TOTAL").slice(0, 12);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Next Month Forecast</CardTitle>
        {total && (
          <span className="text-lg font-bold">{fmt(total.predicted_spend)} PLN</span>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left pb-2">Category</th>
                <th className="text-right pb-2">Predicted</th>
                <th className="text-right pb-2">Avg historical</th>
                <th className="text-right pb-2">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.category}>
                  <td className="py-1.5 font-medium">{row.category}</td>
                  <td className="py-1.5 text-right font-semibold">{fmt(row.predicted_spend)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{fmt(row.avg_historical)}</td>
                  <td className="py-1.5 text-right">
                    <Badge className={`text-xs ${confidenceStyle[row.confidence] ?? confidenceStyle.low}`}>
                      {row.confidence}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
