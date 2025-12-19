import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, gradient }) {
  return (
    <Card className={cn(
      "relative overflow-hidden p-6 transition-all hover:shadow-2xl border-3",
      gradient ? "bg-gradient-to-br shadow-xl" : "bg-white",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-900">
            {title}
          </p>
          <h3 className="text-3xl font-black tracking-tight text-gray-900">
            {value}
          </h3>
          {subtitle && (
            <p className="text-sm font-semibold text-gray-800">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-bold",
              trendUp ? "text-green-600" : "text-red-600"
            )}>
              <span>{trendUp ? '↑' : '↓'}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "p-4 rounded-2xl shadow-lg",
            gradient ? "bg-white/30 backdrop-blur-sm" : "bg-gradient-to-br from-blue-100 to-indigo-100"
          )}>
            <Icon className="w-7 h-7 text-gray-900 font-bold" />
          </div>
        )}
      </div>
      {/* Decorative element */}
      <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full opacity-20 bg-gradient-to-br from-blue-400 to-purple-500" />
    </Card>
  );
}