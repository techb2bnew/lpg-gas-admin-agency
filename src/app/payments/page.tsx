
"use client";

import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Order } from '@/lib/types';
import { Loader2, CreditCard } from 'lucide-react';
import { useEffect, useState, useMemo, useContext, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AuthContext, useAuth } from '@/context/auth-context';
import { ProfileContext } from '@/context/profile-context';

const ITEMS_PER_PAGE = 10;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function PaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const { token, handleApiError } = useAuth();
  const { profile } = useContext(ProfileContext);
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  
  // const fetchTransactions = useCallback(async (page = 1) => {
  //   if (!token) return;
  //   setIsLoading(true);
  //   try {
  //       const statuses = ['delivered', 'out_for_delivery'];
  //       const response = await fetch(`${API_BASE_URL}/api/orders?page=${page}&limit=${ITEMS_PER_PAGE}&status=${statuses.join(',')}`, {
  //           headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
  //       });
  //       if (!response.ok) {
  //           handleApiError(response);
  //           return;
  //       }
  //       const result = await response.json();
  //       if (result.success) {
  //           setOrders(result.data.orders);
  //       } else {
  //           toast({ variant: 'destructive', title: 'Error', description: result.message || 'Failed to fetch transactions.' });
  //       }
  //   } catch (error) {
  //     toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred while fetching transactions.' });
  //   } finally {
  //     setIsLoading(false);
  //   }
  // }, [token, toast, handleApiError]);


  // useEffect(() => {
  //   fetchTransactions(currentPage);
  // }, [fetchTransactions, currentPage]);

  const totalPages = useMemo(() => {
    // This is a simplification. For real pagination, the API should return total pages/items.
    return orders.length < ITEMS_PER_PAGE ? currentPage : currentPage + 1;
  }, [orders, currentPage]);

  const paymentStatusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
    'paid': 'default',
    'pending': 'secondary',
    'failed': 'destructive',
  };

  return (
    <AppShell>
      <PageHeader title="Payments" />
        <Card>
          <CardHeader>
            <CardTitle>Completed & In-Transit Orders</CardTitle>
            <CardDescription>
              A log of all successfully delivered or out for delivery orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
               <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Delivered At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CreditCard className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">No payments found</p>
                          <p className="text-xs text-muted-foreground">There are no payments to display at this time.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order: Order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-primary hover:underline cursor-pointer">#{order.orderNumber.slice(-8)}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>KSH{parseFloat(order.totalAmount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={paymentStatusVariant[order.paymentStatus.toLowerCase()] || 'secondary'} className="capitalize">{order.paymentStatus}</Badge>
                      </TableCell>
                       <TableCell>{order.agency?.name || 'N/A'}</TableCell>
                       <TableCell>{order.assignedAgent?.name || 'N/A'}</TableCell>
                      <TableCell>{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : 'In Transit'}</TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {totalPages > 1 && (
            <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                    Showing page {currentPage} of {totalPages}.
                </div>
                <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={orders.length < ITEMS_PER_PAGE}
                >
                    Next
                </Button>
                </div>
            </CardFooter>
            )}
        </Card>
         {isAdmin && (
            <Card>
                <CardHeader>
                    <CardTitle>Payment Methods</CardTitle>
                    <CardDescription>Activate or deactivate payment methods available to customers.</CardDescription>
                </CardHeader>
                {/* Content for payment methods would go here */}
            </Card>
        )}
    </AppShell>
  );
}
