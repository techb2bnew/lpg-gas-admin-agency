
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval, isWithinInterval, Interval } from 'date-fns';
import { Order } from '@/lib/types';

const chartConfig = {
  pending: { 
    label: "Pending Orders", 
    color: "#f59e0b"
  },
  delivered: { 
    label: "Delivered Orders", 
    color: "#10b981"
  },
  cancelled: { 
    label: "Cancelled Orders", 
    color: "#ef4444"
  },
  out_for_delivery: { 
    label: "Out for Delivery", 
    color: "#3b82f6"
  },
} satisfies ChartConfig;

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface OrderStatusChartProps {
    orders: Order[];
}

export function OrderStatusChart({ orders }: OrderStatusChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');

  const processedData = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    
    let interval;
    let formatLabel: (date: Date) => string;
    let getIntervals: (interval: Interval) => Date[];

    const today = new Date();

    switch(timeframe) {
      case 'daily':
        interval = { start: subDays(today, 6), end: today };
        getIntervals = (i) => eachDayOfInterval(i);
        formatLabel = (d) => format(d, 'MMM dd');
        break;
      case 'weekly':
        interval = { start: subDays(startOfWeek(today, { weekStartsOn: 1 }), 4*7), end: endOfWeek(today) };
        getIntervals = (i) => eachWeekOfInterval(i, { weekStartsOn: 1 });
        formatLabel = (d) => `W${format(d, 'w')}`;
        break;
      case 'monthly':
        interval = { start: startOfYear(today), end: endOfYear(today) };
        getIntervals = (i) => eachMonthOfInterval(i);
        formatLabel = (d) => format(d, 'MMM');
        break;
      case 'yearly':
        const oldestOrderDate = orders.reduce((oldest, order) => {
          const orderDate = new Date(order.createdAt);
          return orderDate < oldest ? orderDate : oldest;
        }, new Date());
        interval = { start: startOfYear(oldestOrderDate), end: today };
        getIntervals = (i) => eachYearOfInterval(i);
        formatLabel = (d) => format(d, 'yyyy');
        break;
    }
    
    const intervals = getIntervals(interval);
    
    return intervals.map((startDate) => {
        let endDate: Date;
        if (timeframe === 'daily') {
          // For daily, we need to include the entire day
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
        } else if (timeframe === 'weekly') {
          endDate = endOfWeek(startDate, { weekStartsOn: 1 });
        } else if (timeframe === 'monthly') {
          endDate = endOfMonth(startDate);
        } else {
          endDate = endOfYear(startDate);
        }
        
        const periodInterval = { start: startDate, end: endDate };

        const ordersInPeriod = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return isWithinInterval(orderDate, periodInterval);
        });
        
        const counts = ordersInPeriod.reduce((acc, order) => {
            const status = order.status.toLowerCase().replace(/[\s-]/g, '_');
            if (status === 'assigned' || status === 'confirmed' || status === 'in_progress' || status === 'pending') {
              acc.pending++;
            } else if (status === 'returned' || status === 'cancelled') {
              acc.cancelled++;
            } else if (status === 'out_for_delivery' || status === 'out_for_delivery') {
              acc.out_for_delivery++;
            } else if (status === 'delivered') {
              acc.delivered++;
            }
            return acc;
          }, { pending: 0, delivered: 0, cancelled: 0, out_for_delivery: 0 });

        return {
            date: formatLabel(startDate),
            fullDate: format(startDate, 'yyyy-MM-dd'),
            ...counts
        };
    });

  }, [orders, timeframe]);

  // Calculate total orders for summary
  const totalOrders = useMemo(() => {
    return orders.reduce((acc, order) => {
      const status = order.status.toLowerCase().replace(/[\s-]/g, '_');
      if (status === 'assigned' || status === 'confirmed' || status === 'in_progress' || status === 'pending') {
        acc.pending++;
      } else if (status === 'returned' || status === 'cancelled') {
        acc.cancelled++;
      } else if (status === 'out_for_delivery') {
        acc.out_for_delivery++;
      } else if (status === 'delivered') {
        acc.delivered++;
      }
      return acc;
    }, { pending: 0, delivered: 0, cancelled: 0, out_for_delivery: 0 });
  }, [orders]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">Order Status Overview</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Real-time tracking of order statuses across different time periods
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select onValueChange={(value) => setTimeframe(value as Timeframe)} defaultValue={timeframe}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">📅 Daily</SelectItem>
                <SelectItem value="weekly">📊 Weekly</SelectItem>
                <SelectItem value="monthly">📈 Monthly</SelectItem>
                <SelectItem value="yearly">📋 Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
            <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
            Pending: {totalOrders.pending}
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Delivered: {totalOrders.delivered}
          </Badge>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Out for Delivery: {totalOrders.out_for_delivery}
          </Badge>
          <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
            Cancelled: {totalOrders.cancelled}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {processedData.length === 0 ? (
          <div className="h-[350px] w-full flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">No Data Available</p>
              <p className="text-sm text-muted-foreground">No orders found for the selected time period.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <AreaChart 
                data={processedData} 
                accessibilityLayer 
                stackOffset="sign"
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="cancelledGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="outForDeliveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke="#e5e7eb"
                  opacity={0.5}
                />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  tickMargin={10} 
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(value) => {
                    if (timeframe === 'daily') return value;
                    if (timeframe === 'weekly') return value;
                    if (timeframe === 'monthly') return value;
                    return value;
                  }}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(value) => value.toString()}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    formatter={(value, name) => [
                      value, 
                      chartConfig[name as keyof typeof chartConfig]?.label || name
                    ]}
                    labelFormatter={(label, payload) => {
                      if (timeframe === 'daily' && payload && payload[0]?.payload?.fullDate) {
                        return `Date: ${payload[0].payload.fullDate}`;
                      }
                      return `Period: ${label}`;
                    }}
                    className="bg-white border shadow-lg rounded-lg"
                  />} 
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-sm font-medium text-gray-700">
                      {chartConfig[value as keyof typeof chartConfig]?.label || value}
                    </span>
                  )}
                />
                <Area 
                  dataKey="pending" 
                  type="monotone" 
                  fill="url(#pendingGradient)" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  stackId="a"
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
                />
                <Area 
                  dataKey="out_for_delivery" 
                  type="monotone" 
                  fill="url(#outForDeliveryGradient)" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  stackId="a"
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                />
                <Area 
                  dataKey="cancelled" 
                  type="monotone" 
                  fill="url(#cancelledGradient)" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  stackId="a"
                  dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                />
                <Area 
                  dataKey="delivered" 
                  type="monotone" 
                  fill="url(#deliveredGradient)" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  stackId="a"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
