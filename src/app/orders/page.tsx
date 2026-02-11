
"use client";

import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MoreHorizontal, FileDown, ChevronDown, Search, Loader2, Calendar as CalendarIcon, X, Eye, UserPlus, RotateCcw, XCircle, ShoppingCart } from 'lucide-react';
import type { Order, Agent } from '@/lib/types';
import { useEffect, useState, useMemo, useContext, useCallback } from 'react';
import { AssignAgentDialog } from '@/components/assign-agent-dialog';
import { CancelOrderDialog } from '@/components/cancel-order-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDate, formatStatus } from '@/lib/utils';
import { ReturnOrderDialog } from '@/components/return-order-dialog';
import { Input } from '@/components/ui/input';
import { AuthContext, useAuth } from '@/context/auth-context';
import { useNotifications } from '@/context/notification-context';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProfileContext } from '@/context/profile-context';
import { useSocket } from '@/context/socket-context';
import { useSocketOrders } from '@/hooks/use-socket-orders';
import { useForceLogout } from '@/hooks/use-force-logout';
import socketService from '@/lib/socket';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ITEMS_PER_PAGE = 10;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const statusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
  'delivered': 'default',
  'pending': 'secondary',
  'confirmed': 'secondary',
  'assigned': 'outline',
  'in-progress': 'outline',
  'out-for-delivery': 'outline',
  'cancelled': 'destructive',
  'returned': 'destructive',
  'return_approved': 'default',
  'return_rejected': 'destructive',
};

const orderStatusesForDropdown: Order['status'][] = ['pending', 'delivered', 'cancelled', 'returned'];
const orderStatusesForTabs: (Order['status'] | 'in-progress')[] = ['pending', 'confirmed', 'in-progress', 'out-for-delivery', 'delivered', 'cancelled', 'returned', 'return_approved', 'return_rejected'];


function OrdersTable({ 
  orders,
  onShowDetails,
  onAssignAgent,
  onStatusChange,
  onReturn,
  onCancel,
  onConfirmAndAssign,
  onPaymentReceivedToggle,
  updatingOrderId,
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  isAdmin,
}: {
  orders: Order[],
  onShowDetails: (order: Order) => void,
  onAssignAgent: (order: Order) => void,
  onStatusChange: (order: Order, status: Order['status']) => void,
  onReturn: (order: Order) => void;
  onCancel: (order: Order) => void;
  onConfirmAndAssign: (order: Order) => void;
  onPaymentReceivedToggle: (order: Order, received: boolean) => void;
  updatingOrderId: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  isAdmin: boolean;
}) {

  const isActionDisabled = (status: Order['status']) => {
    return ['delivered', 'returned'].includes(status);
  }
  
  const tableStatus = orders[0]?.status;


  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                {isAdmin && <TableHead className="hidden sm:table-cell">Agency</TableHead>}
                <TableHead>Delivery Mode</TableHead>
                <TableHead>Payment Method</TableHead>
                {tableStatus !== 'pending' && <TableHead className="hidden sm:table-cell">Agent</TableHead>}
                {tableStatus === 'confirmed' && <TableHead>Payment Received</TableHead>}
                <TableHead className="hidden md:table-cell">Amount</TableHead>
                <TableHead className="hidden lg:table-cell">Order Status</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">No orders found</p>
                      <p className="text-xs text-muted-foreground">There are no orders to display at this time.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order: Order) => (
                <TableRow
                  key={order.id}
                  onClick={() => onShowDetails(order)}
                  className={cn("cursor-pointer", {
                    "bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30": order.deliveryMode === 'pickup'
                  })}
                >
                  <TableCell className="font-medium text-primary">#{order.orderNumber.slice(-8)}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>
                    {order.items.map((item, index) => (
                        <div key={index} className="text-xs">
                          <span className="font-semibold">{item.productName}</span>
                          <span> (quantity: {item.quantity})</span>
                          <div className="text-muted-foreground">{item.variantLabel}</div>
                           {index < order.items.length - 1 && <Separator className="my-1"/>}
                        </div>
                    ))}
                  </TableCell>
                   {isAdmin && (
                        <TableCell className="hidden sm:table-cell">
                            {order.agency ? (
                            <Badge variant="outline">{order.agency.name}</Badge>
                            ) : (
                            <span className="text-muted-foreground">N/A</span>
                            )}
                        </TableCell>
                    )}
                  <TableCell className="capitalize">
                    {order.deliveryMode?.replace('_', ' ')}
                  </TableCell>
                  <TableCell className="capitalize">
                    {order.paymentMethod?.replace('_', ' ')}
                  </TableCell>
                   {tableStatus !== 'pending' && (
                        <TableCell className="hidden sm:table-cell">
                            {order.assignedAgent ? (
                            <Badge variant="outline">{order.assignedAgent.name}</Badge>
                            ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                            )}
                        </TableCell>
                    )}
                  {tableStatus === 'confirmed' && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {order.deliveryMode === 'pickup' ? (
                          <div className="flex items-center space-x-2">
                             <Switch
                                id={`payment-${order.id}`}
                                checked={order.paymentReceived}
                                onCheckedChange={(checked) => onPaymentReceivedToggle(order, checked)}
                                disabled={!!updatingOrderId && updatingOrderId === order.id}
                              />
                              <Label htmlFor={`payment-${order.id}`} className={cn(order.paymentReceived ? "text-primary" : "text-destructive")}>
                                {order.paymentReceived ? 'Paid' : 'Unpaid'}
                              </Label>
                          </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell">KSH{parseFloat(order.totalAmount).toLocaleString()}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="w-40 justify-between capitalize" onClick={(e) => e.stopPropagation()}>
                                <Badge variant={statusVariant[order.status]} className="pointer-events-none">{formatStatus(order.status)}</Badge>
                                <ChevronDown className="h-4 w-4 text-muted-foreground"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuRadioGroup 
                                value={order.status} 
                                onValueChange={(newStatus) => onStatusChange(order, newStatus as Order['status'])}
                            >
                            {order.status === 'returned' ? (
                                <>
                                    <DropdownMenuRadioItem value="return_approved">
                                        Return Approve
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="return_rejected">
                                        Return Reject
                                    </DropdownMenuRadioItem>
                                    {orderStatusesForDropdown.filter(s => !['assigned', 'out-for-delivery'].includes(s)).map(status => (
                                        <DropdownMenuRadioItem 
                                            key={status} 
                                            value={status}
                                            disabled={true}
                                        >
                                            {formatStatus(status)}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </>
                            ) : order.status === 'return_approved' ? (
                                <>
                                    <DropdownMenuRadioItem value="returned">
                                        Return Requests
                                    </DropdownMenuRadioItem>
                                    {orderStatusesForDropdown.filter(s => !['assigned', 'out-for-delivery'].includes(s)).map(status => (
                                        <DropdownMenuRadioItem 
                                            key={status} 
                                            value={status}
                                            disabled={true}
                                        >
                                            {formatStatus(status)}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </>
                            ) : order.status === 'return_rejected' ? (
                                <>
                                    <DropdownMenuRadioItem value="returned">
                                        Return Requests
                                    </DropdownMenuRadioItem>
                                    {orderStatusesForDropdown.filter(s => !['assigned', 'out-for-delivery'].includes(s)).map(status => (
                                        <DropdownMenuRadioItem 
                                            key={status} 
                                            value={status}
                                            disabled={true}
                                        >
                                            {formatStatus(status)}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </>
                            ) : (
                                orderStatusesForDropdown.filter(s => !['assigned', 'out-for-delivery'].includes(s)).map(status => (
                                    <DropdownMenuRadioItem 
                                    key={status} 
                                    value={status}
                                    disabled={
                                        (status === 'in-progress' && !order.assignedAgent) || 
                                        isActionDisabled(order.status)
                                    }
                                    >
                                    {formatStatus(status)}
                                    {status === 'in-progress' && !order.assignedAgent && " (Assign agent first)"}
                                    </DropdownMenuRadioItem>
                                ))
                            )}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {order.status === 'cancelled' && order.cancelledBy && (
                        <p className="text-xs text-muted-foreground mt-1">
                          by <span className="font-medium capitalize">{order.cancelledByName || order.cancelledBy}</span>
                        </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {order.status === 'pending' ? (
                       <div className="flex gap-2">
                            <Button size="sm" onClick={() => onConfirmAndAssign(order)} disabled={!!updatingOrderId}>
                              {updatingOrderId === order.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                              Confirm
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => onCancel(order)} disabled={!!updatingOrderId}>
                              Cancel
                            </Button>
                       </div>
                    ) : (
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onShowDetails(order)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                            </DropdownMenuItem>
                            {(order.status === 'confirmed' && order.deliveryMode !== 'pickup') && (
                            <DropdownMenuItem className="bg-primary text-primary-foreground hover:!bg-primary/90 hover:!text-primary-foreground focus:!bg-primary/90 focus:!text-primary-foreground" onClick={() => onAssignAgent(order)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Assign Agent
                            </DropdownMenuItem>
                            )}
                            {order.status === 'assigned' && (
                            <DropdownMenuItem className="bg-blue-500 text-white hover:!bg-blue-600 hover:!text-white focus:!bg-blue-600 focus:!text-white" onClick={() => onAssignAgent(order)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                {order.assignedAgent ? 'Change Agent' : 'Assign Agent'}
                            </DropdownMenuItem>
                            )}
                            {order.status === 'delivered' && (
                                <DropdownMenuItem onClick={() => onReturn(order)}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Return
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                                onClick={() => onCancel(order)} 
                                className="text-destructive"
                                disabled={isActionDisabled(order.status)}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel Order
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
       {totalPages > 1 && (
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {orders.length} of {totalItems} orders.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useContext(ProfileContext);
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  // Socket hooks
  const { isConnected } = useSocket();
  const { orders: socketOrders, addOrder, updateOrder, clearOrders } = useSocketOrders();
  useForceLogout(); // Enable force logout functionality

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const { token, handleApiError } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const { socket, removeNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [pendingPickupDeliveryOrder, setPendingPickupDeliveryOrder] = useState<Order | null>(null);
  const [isPickupConfirmModalOpen, setIsPickupConfirmModalOpen] = useState(false);
  const [isProcessingPickupDelivery, setIsProcessingPickupDelivery] = useState(false);

  // Calculate total orders across all statuses
  const totalOrdersCount = useMemo(() => {
    return Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  }, [statusCounts]);

  const fetchOrders = useCallback(async (page = 1, status = activeTab, search = searchTerm, start?: Date, end?: Date) => {
      if (!token) return;
      setIsLoading(true);
      try {
          const url = new URL(`${API_BASE_URL}/api/orders`);
          url.searchParams.append('page', String(page));
          url.searchParams.append('limit', String(ITEMS_PER_PAGE));
          if (status && status !== 'all') {
            const statusParam = status === 'in-progress' ? 'assigned' : status === 'out-for-delivery' ? 'out_for_delivery' : status;
            url.searchParams.append('status', statusParam);
          }
          if (search) {
              url.searchParams.append('search', search);
          }
          if (start) {
            url.searchParams.append('startDate', format(start, 'yyyy-MM-dd'));
          }
          if (end) {
              url.searchParams.append('endDate', format(end, 'yyyy-MM-dd'));
          }

          const response = await fetch(url.toString(), {
              headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
          });
          if (!response.ok) handleApiError(response);
          const result = await response.json();
          if (result.success) {
              setOrders(result.data.orders);
              setPagination(result.data.pagination);
              // Update the count for the current status based on filtered data length
              setStatusCounts(prev => ({
                ...prev,
                [status]: result.data.pagination.totalItems
              }));
          } else {
              toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch orders.' });
          }
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch orders.' });
      } finally {
          setIsLoading(false);
      }
  }, [token, toast, handleApiError, activeTab, searchTerm]);

  const fetchStatusCounts = useCallback(async (search = searchTerm, start?: Date, end?: Date) => {
    if (!token) return;
    
    try {
      // Fetch counts for each status with the same filters (search, dates)
      const counts: Record<string, number> = {};
      
      // Initialize all status counts to 0
      orderStatusesForTabs.forEach(status => {
        counts[status] = 0;
      });
      
      // Fetch counts for each status individually with filters
      const countPromises = orderStatusesForTabs.map(async (status) => {
        const url = new URL(`${API_BASE_URL}/api/orders`);
        url.searchParams.append('page', '1');
        url.searchParams.append('limit', '1'); // We only need the totalItems count
        const statusParam = status === 'in-progress' ? 'assigned' : status === 'out-for-delivery' ? 'out_for_delivery' : status;
        url.searchParams.append('status', statusParam);
        
        if (search) {
          url.searchParams.append('search', search);
        }
        if (start) {
          url.searchParams.append('startDate', format(start, 'yyyy-MM-dd'));
        }
        if (end) {
          url.searchParams.append('endDate', format(end, 'yyyy-MM-dd'));
        }
        
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
      console.error('Failed to fetch status counts', error);
    }
  }, [token, searchTerm]);

  useEffect(() => {
    fetchOrders(1, activeTab, searchTerm, startDate, endDate);
    fetchStatusCounts(searchTerm, startDate, endDate);
  }, [activeTab, searchTerm, startDate, endDate, fetchOrders, fetchStatusCounts]);

  const handlePageChange = (newPage: number) => {
      fetchOrders(newPage, activeTab, searchTerm, startDate, endDate);
  }

  // Socket connection status effect
  // useEffect(() => {
  //   if (isConnected) {
  //     toast({
  //       title: "🔗 Real-time Connected",
  //       description: "You'll receive live updates for orders",
  //       variant: "default",
  //     });
  //   }
  // }, [isConnected, toast]);

  // New socket event handlers for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const handleOrderCreated = () => {
      console.log('🔄 Order created event received, refreshing...');
      fetchOrders(pagination.currentPage, activeTab, searchTerm, startDate, endDate); 
      fetchStatusCounts(searchTerm, startDate, endDate);
    };

    const handleOrderUpdate = () => {
      console.log('🔄 Order update event received, refreshing...');
      fetchOrders(pagination.currentPage, activeTab, searchTerm, startDate, endDate); 
      fetchStatusCounts(searchTerm, startDate, endDate);
    };

    // Listen to socket events
    socketService.on('order:created', handleOrderCreated);
    socketService.on('order:status-updated', handleOrderUpdate);
    socketService.on('order:assigned', handleOrderUpdate);
    socketService.on('order:delivered', handleOrderUpdate);

    return () => {
      socketService.off('order:created', handleOrderCreated);
      socketService.off('order:status-updated', handleOrderUpdate);
      socketService.off('order:assigned', handleOrderUpdate);
      socketService.off('order:delivered', handleOrderUpdate);
    };
  }, [isConnected, fetchOrders, fetchStatusCounts, activeTab, searchTerm, startDate, endDate, pagination.currentPage]);

  // Legacy socket event handlers (keeping for backward compatibility)
  useEffect(() => {
    if (socket) {
      const handleDataUpdate = () => {
        toast({ title: 'Live Update', description: 'Order data has been updated.'});
        fetchOrders(pagination.currentPage, activeTab, searchTerm, startDate, endDate); 
        fetchStatusCounts(searchTerm, startDate, endDate);
      };

      socket.on('order_updated', handleDataUpdate);
      socket.on('order_deleted', handleDataUpdate);
      socket.on('payment_updated', handleDataUpdate);

      return () => {
          socket.off('order_updated', handleDataUpdate);
          socket.off('order_deleted', handleDataUpdate);
          socket.off('payment_updated', handleDataUpdate);
      };
    }
  }, [socket, fetchOrders, fetchStatusCounts, activeTab, searchTerm, startDate, endDate, pagination.currentPage]);

  const fetchAgents = useCallback(async () => {
     if (!token) return;
     try {
       const response = await fetch(`${API_BASE_URL}/api/delivery-agents`, {
            headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        if (!response.ok) handleApiError(response);
        const result = await response.json();
        if (result.success) {
            setAgents(result.data.agents);
        }
    } catch (error) {
       console.error("Failed to load agents", error);
    }
  }, [token, handleApiError]);

  useEffect(() => {
    fetchAgents();
  }, [token, fetchAgents]);
  
  useEffect(() => {
    const assignAgentOrderId = searchParams.get('assignAgent');
    if (assignAgentOrderId) {
      const orderToAssign = orders.find(o => o.id === assignAgentOrderId) || { id: assignAgentOrderId } as Order; 
      if (orderToAssign) {
        handleAssignAgent(orderToAssign);
        router.replace('/orders', { scroll: false });
      }
    }
  }, [searchParams, orders, router]);

  const handleShowDetails = (order: Order) => {
    router.push(`/orders/${order.id}`);
  };
  
  const handleAssignAgent = (order: Order) => {
    setSelectedOrder(order);
    setIsAssignOpen(true);
  };
  
  const handleCancelOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsCancelOpen(true);
  };

  const handleReturnOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsReturnOpen(true);
  };

  const handleAgentAssigned = async (orderId: string, agentId: string) => {
    if (!token) return;
    
    try {
      const assignResponse = await fetch(`${API_BASE_URL}/api/orders/${orderId}/assign`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ agentId })
      });

      if (!assignResponse.ok) {
        const result = await assignResponse.json();
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to assign agent.' });
        return;
      }
      
      const assignResult = await assignResponse.json();
      if(assignResult.success) {
        toast({
          title: "Agent Assigned",
          description: `Agent has been assigned to the order.`,
        });

        await updateOrderStatus(assignResult.data.order, 'assigned', 'Agent assigned');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: assignResult.error || 'Failed to assign agent.' });
      }

    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign agent.' });
    }
  };


  const onUpdate = () => {
    fetchOrders(pagination.currentPage, activeTab, searchTerm, startDate, endDate);
    fetchStatusCounts(searchTerm, startDate, endDate);
  }

  const updateOrderStatus = async (order: Order, newStatus: Order['status'], notes?: string): Promise<boolean> => {
    if (!token) return false;
    setUpdatingOrderId(order.id);

    const requestBody: { status: Order['status'], adminNotes?: string } = { status: newStatus };
    if (notes) {
      requestBody.adminNotes = notes;
    }

    try {
       const response = await fetch(`${API_BASE_URL}/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        handleApiError(response);
        setUpdatingOrderId(null);
        return false;
      };
      const result = await response.json();
       if (result.success) {
        toast({
          title: 'Order Status Updated',
          description: `Order #${order.orderNumber?.slice(-8)} has been marked as ${newStatus}.`
        });
        if(newStatus === 'confirmed') {
            removeNotification(order.id);
        }
        onUpdate();
        return true;
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update status.' });
        return false;
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
      return false;
    } finally {
      setUpdatingOrderId(null);
    }
  }


  const handleStatusChange = async (order: Order, newStatus: Order['status']) => {
    if (order.status === newStatus) return;
    
    if (newStatus === 'cancelled') {
      handleCancelOrder(order);
      return;
    }

    if (
      order.deliveryMode === 'pickup' &&
      order.status === 'pending' &&
      newStatus === 'delivered'
    ) {
      setPendingPickupDeliveryOrder(order);
      setIsPickupConfirmModalOpen(true);
      return;
    }
    
    let notes;
    if (newStatus === 'confirmed') {
        notes = 'Order confirmed and ready for delivery';
    } else if (newStatus === 'return_approved') {
        const userRole = profile.role === 'admin' || profile.role === 'super_admin' ? 'admin' : 'agency';
        notes = `Return request approved by ${userRole}`;
    } else if (newStatus === 'return_rejected') {
        const userRole = profile.role === 'admin' || profile.role === 'super_admin' ? 'admin' : 'agency';
        notes = `Return request rejected by ${userRole}`;
    }

    await updateOrderStatus(order, newStatus, notes);
  }
  
  const handleConfirmAndAssign = async (order: Order) => {
    // For pickup orders, just confirm.
    if (order.deliveryMode === 'pickup') {
      await updateOrderStatus(order, 'confirmed', 'Order confirmed for pickup');
    } else {
      // For home delivery, don't update status, just open assign dialog.
      // Status will be updated upon successful assignment.
      handleAssignAgent(order);
    }
  };

  const handlePaymentReceivedToggle = async (order: Order, received: boolean) => {
    if (!token) return;
    setUpdatingOrderId(order.id);
    const notes = received ? "Payment received in cash at counter" : "Customer did not come for pickup";
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${order.id}/payment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ paymentReceived: received, notes: notes })
      });
      const result = await response.json();
      if (!response.ok) {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update payment status.' });
        return;
      }
      if (result.success) {
        toast({ title: 'Payment Status Updated', description: `Order payment status set to ${received ? 'Paid' : 'Unpaid'}` });
        onUpdate();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update payment status.' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleConfirmPickupBeforeDelivery = async () => {
    if (!pendingPickupDeliveryOrder) return;
    setIsProcessingPickupDelivery(true);
    const order = pendingPickupDeliveryOrder;
    const confirmed = await updateOrderStatus(order, 'confirmed', 'Order confirmed for pickup');
    if (confirmed) {
      toast({
        title: 'Order Confirmed',
        description: 'The pickup order has been confirmed.',
      });
      setIsPickupConfirmModalOpen(false);
      setPendingPickupDeliveryOrder(null);
    }
    setIsProcessingPickupDelivery(false);
  };

  const handlePickupModalOpenChange = (open: boolean) => {
    setIsPickupConfirmModalOpen(open);
    if (!open) {
      setPendingPickupDeliveryOrder(null);
    }
  };

  const confirmCancelOrder = async (reason: string) => {
    if (selectedOrder) {
       await updateOrderStatus(selectedOrder, 'cancelled', reason);
       setIsCancelOpen(false);
       setSelectedOrder(null);
    }
  };

  const confirmReturnOrder = async (reason: string) => {
     if (selectedOrder) {
       await updateOrderStatus(selectedOrder, 'returned', reason);
       setIsReturnOpen(false);
       setSelectedOrder(null);
    }
  };
  
  const handleExport = async () => {
    if (!token) {
      toast({ variant: 'destructive', title: 'Error', description: 'Authentication required.' });
      return;
    }
    
    try {
      setIsLoading(true);
      // Use query parameter instead of path parameter to avoid UUID parsing issue
      const url = new URL(`${API_BASE_URL}/api/orders`);
      url.searchParams.append('export', 'true');
      url.searchParams.append('limit', '10000'); // Get all filtered orders
      
      // Add current filters to export based on active tab
      if (activeTab && activeTab !== 'all') {
        const statusParam = activeTab === 'in-progress' ? 'assigned' : activeTab === 'out-for-delivery' ? 'out_for_delivery' : activeTab;
        url.searchParams.append('status', statusParam);
      }
      if (searchTerm) {
        url.searchParams.append('search', searchTerm);
      }
      if (startDate) {
        url.searchParams.append('startDate', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        url.searchParams.append('endDate', format(endDate, 'yyyy-MM-dd'));
      }
      
      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast({ 
          variant: 'destructive', 
          title: 'Export Failed', 
          description: errorData.error || errorData.message || 'Failed to export orders. Please try again.' 
        });
        setIsLoading(false);
        return;
      }
      
      // Check if response is CSV or JSON
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // If API returns JSON, convert to Excel/CSV
        const data = await response.json();
        if (data.success && data.data && data.data.orders) {
          const orders = data.data.orders;
          
          // Convert to CSV format
          const csvHeader = 'Order ID,Customer,Items,Agency,Delivery Mode,Payment Method,Agent,Amount,Status,Date\n';
          const csvRows = orders.map((order: Order) => {
            const items = order.items.map(item => `${item.productName} (${item.quantity}x)`).join('; ');
            const agent = order.assignedAgent ? order.assignedAgent.name : 'Unassigned';
            const agency = order.agency ? order.agency.name : 'N/A';
            
            // Fix amount formatting - ensure proper number without locale-specific formatting or commas
            const amountValue = order.totalAmount ? parseFloat(String(order.totalAmount)) : 0;
            const formattedAmount = isNaN(amountValue) ? '0.00' : amountValue.toFixed(2);
            // Remove any commas that might be added by toLocaleString
            const amount = `KSH${formattedAmount.replace(/,/g, '')}`;
            
            // Fix status formatting - ensure clean text without numbers
            const status = formatStatus(order.status || 'Unknown');
            
            // Fix date formatting - use Excel-friendly format (YYYY-MM-DD)
            let formattedDate = '';
            if (order.createdAt) {
              try {
                const date = new Date(order.createdAt);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  formattedDate = `${year}-${month}-${day}`;
                }
              } catch (e) {
                formattedDate = '';
              }
            }
            
            // Properly escape CSV values - always quote to prevent Excel parsing issues
            const escapeCSV = (value: string) => {
              const cleanValue = String(value || '').replace(/"/g, '""');
              // Always quote values to prevent Excel from misinterpreting commas, numbers, etc.
              return `"${cleanValue}"`;
            };
            
            return [
              escapeCSV(`#${order.orderNumber ? order.orderNumber.slice(-8) : order.id.slice(0, 8)}`),
              escapeCSV(order.customerName || 'Unknown'),
              escapeCSV(items),
              escapeCSV(agency),
              escapeCSV(order.deliveryMode?.replace(/_/g, ' ') || 'N/A'),
              escapeCSV(order.paymentMethod?.replace(/_/g, ' ') || 'N/A'),
              escapeCSV(agent),
              escapeCSV(amount),
              escapeCSV(status),
              escapeCSV(formattedDate)
            ].join(',');
          }).join('\n');
          
          const csvContent = csvHeader + csvRows;
          const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
          const link = document.createElement('a');
          const urlObj = URL.createObjectURL(blob);
          link.href = urlObj;
          const statusName = activeTab === 'in-progress' ? 'In-Progress' : formatStatus(activeTab);
          const fileName = `orders_${statusName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(urlObj);
        }
      } else {
        // If API returns CSV/blob directly
        const blob = await response.blob();
        const link = document.createElement('a');
        const urlObj = URL.createObjectURL(blob);
        link.href = urlObj;
        const statusName = activeTab === 'in-progress' ? 'In-Progress' : formatStatus(activeTab);
        const fileName = `orders_${statusName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(urlObj);
      }
      
      toast({ 
        title: 'Export Successful', 
        description: `${formatStatus(activeTab)} orders have been exported successfully.` 
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Export Error', 
        description: 'An error occurred while exporting orders. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  }

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  }

  return (
    <AppShell
      onConfirmAndAssignFromNotification={handleConfirmAndAssign}
      orders={orders}
    >
      <PageHeader title="Orders Management">
        <div className="flex items-center gap-2">
          {/* Socket Connection Status */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted">
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-primary" : "bg-red-500")} />
            <span className="text-xs text-muted-foreground">
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
           <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by customer, agent or ID..."
                className="pl-8 sm:w-[300px]"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
             <Popover>
                <PopoverTrigger asChild>
                    <Button
                    variant={"outline"}
                    className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Start date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                    key={`start-date-${startDate?.getTime() || 'none'}`}
                    mode="single"
                    selected={startDate || undefined}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                      } else {
                        setStartDate(undefined);
                      }
                    }}
                    modifiersClassNames={{
                      selected: "bg-primary text-primary-foreground"
                    }}
                    initialFocus
                    />
                </PopoverContent>
            </Popover>
             <Popover>
                <PopoverTrigger asChild>
                    <Button
                    variant={"outline"}
                    className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>End date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                    key={`end-date-${endDate?.getTime() || 'none'}`}
                    mode="single"
                    selected={endDate || undefined}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                      } else {
                        setEndDate(undefined);
                      }
                    }}
                    modifiersClassNames={{
                      selected: "bg-primary text-primary-foreground"
                    }}
                    initialFocus
                    />
                </PopoverContent>
            </Popover>
             {(startDate || endDate) && (
              <Button variant="ghost" size="icon" onClick={clearDateFilter} className="bg-red-500 hover:bg-red-600 text-white">
                <X className="h-4 w-4" />
                <span className="sr-only">Clear date filter</span>
              </Button>
            )}
          <Button size="sm" variant="outline" className="h-9 gap-1" onClick={handleExport}>
            <FileDown className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Export
            </span>
          </Button>
        </div>
      </PageHeader>
      {isLoading && orders.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
      <Tabs defaultValue="pending" onValueChange={setActiveTab}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Total Orders:</span> {totalOrdersCount}
          </div>
        </div>
        <div className="overflow-x-auto">
          <TabsList className="bg-muted p-1 rounded-lg">
            {orderStatusesForTabs.map(status => (
              <TabsTrigger 
                key={status} 
                value={status}
                className="px-4 py-1.5 text-sm font-medium rounded-md"
              >
                <span className="mr-2">{formatStatus(status)}</span>
                 <Badge variant={status === activeTab ? 'default' : 'secondary'}>
                    {statusCounts[status] ?? 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
          <TabsContent value={activeTab} className="mt-4">
            <OrdersTable 
              orders={orders}
              onShowDetails={handleShowDetails}
              onAssignAgent={handleAssignAgent}
              onStatusChange={handleStatusChange}
              onReturn={handleReturnOrder}
              onCancel={handleCancelOrder}
              onConfirmAndAssign={handleConfirmAndAssign}
              onPaymentReceivedToggle={handlePaymentReceivedToggle}
              updatingOrderId={updatingOrderId}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              totalItems={pagination.totalItems}
              isAdmin={isAdmin}
            />
          </TabsContent>
      </Tabs>
      )}
      
      {selectedOrder && <AssignAgentDialog order={selectedOrder} isOpen={isAssignOpen} onOpenChange={setIsAssignOpen} onAgentAssigned={handleAgentAssigned} initialAgents={agents} />}
      {selectedOrder && <CancelOrderDialog order={selectedOrder} isOpen={isCancelOpen} onOpenChange={setIsCancelOpen} onConfirm={confirmCancelOrder} />}
      {selectedOrder && <ReturnOrderDialog order={selectedOrder} isOpen={isReturnOpen} onOpenChange={setIsReturnOpen} onConfirm={confirmReturnOrder} />}
      <Dialog open={isPickupConfirmModalOpen} onOpenChange={handlePickupModalOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Pickup Order First</DialogTitle>
            <DialogDescription>
              This pickup order is still pending. Please confirm the order before marking it as delivered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2">
            <Button
              variant="outline"
              onClick={() => handlePickupModalOpenChange(false)}
              disabled={isProcessingPickupDelivery}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmPickupBeforeDelivery} disabled={isProcessingPickupDelivery}>
              {isProcessingPickupDelivery ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}

export default function OrdersPage() {
    return (
        <OrdersPageContent />
    );
}
