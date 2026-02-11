
"use client";

import { useMemo, useState, useEffect, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval, isWithinInterval, Interval } from 'date-fns';
import { Order } from '@/lib/types';
import { AuthContext } from '@/context/auth-context';

const chartConfig = {
  pending: { 
    label: "Pending Orders", 
    color: "#f59e0b"
  },
  confirmed: { 
    label: "Click and Collect", 
    color: "#8b5cf6"
  },
  in_progress: { 
    label: "In-Progress Orders", 
    color: "#06b6d4"
  },
  out_for_delivery: { 
    label: "Out for Delivery", 
    color: "#3b82f6"
  },
  delivered: { 
    label: "Delivered Orders", 
    color: "#10b981"
  },
  cancelled: { 
    label: "Cancelled Orders", 
    color: "#ef4444"
  },
  returned: { 
    label: "Return Requests", 
    color: "#f97316"
  },
  return_approved: { 
    label: "Return Approved", 
    color: "#10b981"
  },
  return_rejected: { 
    label: "Return Rejected", 
    color: "#ef4444"
  },
} satisfies ChartConfig;

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface OrderStatusChartProps {
    orders: Order[];
}

const orderStatusesForTabs: (Order['status'] | 'in-progress')[] = ['pending', 'confirmed', 'in-progress', 'out-for-delivery', 'delivered', 'cancelled', 'returned', 'return_approved', 'return_rejected'];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function OrderStatusChart({ orders }: OrderStatusChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
  const { token } = useContext(AuthContext);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    pending: 0,
    confirmed: 0,
    'in-progress': 0,
    'out-for-delivery': 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,
    return_approved: 0,
    return_rejected: 0
  });
  const [allOrdersForChart, setAllOrdersForChart] = useState<Order[]>([]);

  // Fetch all orders and counts from API like Orders page does
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      
      try {
        const counts: Record<string, number> = {};
        
        // Initialize all status counts to 0
        orderStatusesForTabs.forEach(status => {
          counts[status] = 0;
        });
        
        // Fetch all orders for graph data (without status filter)
        const allOrdersUrl = new URL(`${API_BASE_URL}/api/orders`);
        allOrdersUrl.searchParams.append('page', '1');
        allOrdersUrl.searchParams.append('limit', '10000'); // Get all orders for accurate graph
        
        const allOrdersResponse = await fetch(allOrdersUrl.toString(), {
          headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        
        if (allOrdersResponse.ok) {
          const allOrdersResult = await allOrdersResponse.json();
          if (allOrdersResult.success) {
            setAllOrdersForChart(allOrdersResult.data.orders || []);
          }
        }
        
        // Fetch counts for each status individually from API
        const countPromises = orderStatusesForTabs.map(async (status) => {
          const url = new URL(`${API_BASE_URL}/api/orders`);
          url.searchParams.append('page', '1');
          url.searchParams.append('limit', '1'); // We only need the totalItems count
          const statusParam = status === 'in-progress' ? 'assigned' : status === 'out-for-delivery' ? 'out_for_delivery' : status;
          url.searchParams.append('status', statusParam);
          
          try {
            const response = await fetch(url.toString(), {
              headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                counts[status] = result.data.pagination.totalItems;
              }
            }
          } catch (error) {
            console.error(`Failed to fetch count for ${status}`, error);
          }
        });
        
        await Promise.all(countPromises);
        setStatusCounts(counts);
      } catch (error) {
        console.error('Failed to fetch data', error);
      }
    };

    fetchData();
  }, [token]);

  const processedData = useMemo(() => {
    // Use API fetched orders if available, otherwise fallback to prop
    const ordersToUse = allOrdersForChart.length > 0 ? allOrdersForChart : orders;
    if (!ordersToUse || ordersToUse.length === 0) return [];
    
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
        const oldestOrderDate = ordersToUse.reduce((oldest, order) => {
          const orderDate = new Date(order.createdAt);
          return orderDate < oldest ? orderDate : oldest;
        }, new Date());
        interval = { start: startOfYear(oldestOrderDate), end: today };
        getIntervals = (i) => eachYearOfInterval(i);
        formatLabel = (d) => format(d, 'yyyy');
        break;
    }
    
    const intervals = getIntervals(interval);
    
    const isLatestPeriod = (startDate: Date, endDate: Date) => {
      if (timeframe === 'daily') {
        return format(startDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      } else if (timeframe === 'weekly') {
        return formatLabel(startDate) === formatLabel(startOfWeek(today, { weekStartsOn: 1 }));
      } else if (timeframe === 'monthly') {
        return formatLabel(startDate) === formatLabel(startOfMonth(today));
      } else {
        return formatLabel(startDate) === formatLabel(startOfYear(today));
      }
    };

    return intervals.map((startDate, index) => {
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
        const isLatest = index === intervals.length - 1 || isLatestPeriod(startDate, endDate);

        // For latest period, use API-fetched counts (current status counts)
        // For historical periods, calculate from orders created in that period
        let counts;
        if (isLatest && statusCounts.pending !== undefined) {
          // Use current status counts for latest period
          counts = {
            pending: statusCounts['pending'] || 0,
            confirmed: statusCounts['confirmed'] || 0,
            in_progress: statusCounts['in-progress'] || 0,
            out_for_delivery: statusCounts['out-for-delivery'] || 0,
            delivered: statusCounts['delivered'] || 0,
            cancelled: statusCounts['cancelled'] || 0,
            returned: statusCounts['returned'] || 0
          };
        } else {
          // Calculate from orders created in this period
          const ordersInPeriod = ordersToUse.filter(order => {
            const orderDate = new Date(order.createdAt);
            return isWithinInterval(orderDate, periodInterval);
          });
          
          counts = ordersInPeriod.reduce((acc, order) => {
            const status = order.status.toLowerCase().replace(/[\s-]/g, '_');
            if (status === 'pending') {
              acc.pending++;
            } else if (status === 'confirmed') {
              acc.confirmed++;
            } else if (status === 'assigned' || status === 'in_progress') {
              acc.in_progress++;
            } else if (status === 'out_for_delivery') {
              acc.out_for_delivery++;
            } else if (status === 'delivered') {
              acc.delivered++;
            } else if (status === 'cancelled') {
              acc.cancelled++;
            } else if (status === 'returned') {
              acc.returned++;
            } else if (status === 'return_approved') {
              acc.return_approved++;
            } else if (status === 'return_rejected') {
              acc.return_rejected++;
            }
            return acc;
          }, { pending: 0, confirmed: 0, in_progress: 0, out_for_delivery: 0, delivered: 0, cancelled: 0, returned: 0, return_approved: 0, return_rejected: 0 });
        }

        return {
            date: formatLabel(startDate),
            fullDate: format(startDate, 'yyyy-MM-dd'),
            ...counts
        };
    });

  }, [allOrdersForChart, orders, timeframe, statusCounts]);

  // Use API fetched counts instead of calculating from orders array
  const totalOrders = useMemo(() => {
    return {
      pending: statusCounts['pending'] || 0,
      confirmed: statusCounts['confirmed'] || 0,
      in_progress: statusCounts['in-progress'] || 0,
      out_for_delivery: statusCounts['out-for-delivery'] || 0,
      delivered: statusCounts['delivered'] || 0,
      cancelled: statusCounts['cancelled'] || 0,
      returned: statusCounts['returned'] || 0,
      return_approved: statusCounts['return_approved'] || 0,
      return_rejected: statusCounts['return_rejected'] || 0
    };
  }, [statusCounts]);

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
          <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
            <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
            Click and Collect: {totalOrders.confirmed}
          </Badge>
          <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-200">
            <div className="w-2 h-2 bg-cyan-500 rounded-full mr-2"></div>
            In-Progress: {totalOrders.in_progress}
          </Badge>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Out for Delivery: {totalOrders.out_for_delivery}
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Delivered: {totalOrders.delivered}
          </Badge>
          <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
            Cancelled: {totalOrders.cancelled}
          </Badge>
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
            Return Requests: {totalOrders.returned}
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Return Approved: {totalOrders.return_approved}
          </Badge>
          <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
            Return Rejected: {totalOrders.return_rejected}
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
                  <linearGradient id="confirmedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="inProgressGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="returnedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.05}/>
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
                      `${value} `, // Add space after count
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
                <Area 
                  dataKey="confirmed" 
                  type="monotone" 
                  fill="url(#confirmedGradient)" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  stackId="a"
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
                />
                <Area 
                  dataKey="in_progress" 
                  type="monotone" 
                  fill="url(#inProgressGradient)" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  stackId="a"
                  dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#06b6d4', strokeWidth: 2 }}
                />
                <Area 
                  dataKey="returned" 
                  type="monotone" 
                  fill="url(#returnedGradient)" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  stackId="a"
                  dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#f97316', strokeWidth: 2 }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
