import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, gradient }) {
  return (
    <Card className={cn(
      "relative overflow-hidden p-6 transition-all hover:shadow-lg",
      gradient ? "bg-gradient-to-br text-white" : "bg-white",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-medium",
            gradient ? "text-white/80" : "text-gray-500"
          )}>
            {title}
          </p>
          <h3 className={cn(
            "text-2xl font-bold tracking-tight",
            gradient ? "text-white" : "text-gray-900"
          )}>
            {value}
          </h3>
          {subtitle && (
            <p className={cn(
              "text-sm",
              gradient ? "text-white/70" : "text-gray-500"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trendUp ? "text-green-500" : "text-red-500"
            )}>
              <span>{trendUp ? '↑' : '↓'}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "p-3 rounded-xl",
            gradient ? "bg-white/20" : "bg-gray-100"
          )}>
            <Icon className={cn(
              "w-6 h-6",
              gradient ? "text-white" : "text-gray-600"
            )} />
          </div>
        )}
      </div>
      {/* Decorative element */}
      <div className={cn(
        "absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10",
        gradient ? "bg-white" : "bg-gray-900"
      )} />
    </Card>
  );
}