
"use client"

import { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/lib/types";
import { AuthContext, useAuth } from '@/context/auth-context';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function UserHoverCard({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const { token } = useContext(AuthContext);
  const { handleApiError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/customers?limit=10`, {
          headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        if (!response.ok) {
          handleApiError(response);
          return;
        }
        const result = await response.json();
        if (result.success) {
          const fetchedUsers = result.data.customers.map((u: any) => ({
            id: u.id || '',
            name: u.name || 'Unknown',
            email: u.email || 'No email',
            phone: u.phone || 'No phone',
            address: u.addresses?.[0]?.address || 'No address provided',
            addresses: u.addresses || [],
            status: u.isBlocked ? 'Blocked' : 'Active',
            isBlocked: u.isBlocked || false,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            orderHistory: [],
            location: { lat: 0, lng: 0 },
            profileImage: u.profileImage || null,
          }));
          setUsers(fetchedUsers);
        }
      } catch (error) {
        console.error("Failed to load users for hover card:", error);
      }
    };
    fetchUsers();
  }, [token, handleApiError]);

  const handleCustomerClick = (e: React.MouseEvent, customerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/customers/${customerId}`);
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <h4 className="font-semibold mb-2">Recent Customers</h4>
        <ScrollArea className="h-48">
          <div className="space-y-4">
            {users.length > 0 ? users.map(user => (
              <div 
                key={user.id} 
                className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                onClick={(e) => handleCustomerClick(e, user.id)}
              >
                <Avatar>
                  <AvatarImage src={user.profileImage || undefined} alt={user.name} />
                  <AvatarFallback>{user.name?.charAt(0) || 'C'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{user.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                </div>
              </div>
            )) : (
               <p className="text-sm text-muted-foreground text-center pt-4">No recent customers found.</p>
            )}
          </div>
        </ScrollArea>
      </HoverCardContent>
    </HoverCard>
  );
}
