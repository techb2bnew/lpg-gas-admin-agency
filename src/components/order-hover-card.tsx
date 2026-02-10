
"use client"

import { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Order } from "@/lib/types";
import { Badge } from './ui/badge';
import { AuthContext, useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const statusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
  'Delivered': 'default',
  'Pending': 'secondary',
  'In-progress': 'outline',
  'Cancelled': 'destructive',
};


export function OrderHoverCard({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const { token } = useContext(AuthContext);
  const { handleApiError } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchAllOrders = async () => {
      if (!token) return;
      try {
        let allOrders: Order[] = [];
        let currentPage = 1;
        let hasMorePages = true;
        const limit = 50; // Backend might have max limit of 50
        
        // Fetch all pages until no more orders
        while (hasMorePages) {
          const url = new URL(`${API_BASE_URL}/api/orders`);
          url.searchParams.append('page', String(currentPage));
          url.searchParams.append('limit', String(limit));
          
          const response = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
          });
          
          if (!response.ok) {
            handleApiError(response);
            break;
          }
          
          const result = await response.json();
          if (result.success) {
            const pageOrders = result.data.orders || [];
            allOrders = [...allOrders, ...pageOrders];
            
            // Check if there are more pages
            const pagination = result.data.pagination;
            if (pagination && currentPage < pagination.totalPages) {
              currentPage++;
            } else {
              hasMorePages = false;
            }
          } else {
            hasMorePages = false;
          }
        }
        
        setOrders(allOrders);
      } catch (error) {
        console.error("Failed to load orders for hover card:", error);
      }
    };
    fetchAllOrders();
  }, [token, toast, handleApiError]);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80 max-h-[600px]">
         <h4 className="font-semibold mb-2">All Orders ({orders.length})</h4>
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {orders.length > 0 ? orders.map(order => (
              <div 
                key={order.id} 
                className="flex justify-between items-start cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`/orders/${order.id}`);
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">#{order.orderNumber ? order.orderNumber.slice(-8) : order.id.slice(0, 6)} - {order.customerName || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">KSH{order.totalAmount ? parseFloat(order.totalAmount).toLocaleString() : '0'}</p>
                </div>
                <Badge variant={statusVariant[order.status] || 'secondary'} className="ml-2 flex-shrink-0">{order.status || 'Unknown'}</Badge>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center pt-4">No orders found.</p>
            )}
          </div>
        </ScrollArea>
      </HoverCardContent>
    </HoverCard>
  );
}
