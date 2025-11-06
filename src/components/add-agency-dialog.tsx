
"use client";

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Agency } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { X, MapPin } from 'lucide-react';
import { loadGooglePlaces, createAutocomplete, parsePlace, createMap, addMapClickListener, reverseGeocode } from '@/hooks/use-google-places';
import { validateEmail } from '@/lib/utils';

type NewAgencyPayload = Omit<Agency, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'profileImage' | 'confirmationToken' | 'confirmationExpiresAt' | 'landmark'> & { landmark?: string };

interface AddAgencyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAgencyAdd: (agency: NewAgencyPayload, image?: File) => Promise<boolean>;
}

const agencySchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string()
    .min(1, "Email is required.")
    .refine((email) => validateEmail(email), {
      message: "Invalid email address format."
    }),
  phone: z.string().length(10, "Phone number must be exactly 10 digits."),
  addressTitle: z.string().min(1, "Address title is required."),
  address: z.string().min(1, "Address is required."),
  city: z.string().min(1, "City is required."),
  pincode: z.string().min(6, "Pincode must be 6 digits.").max(6, "Pincode must be 6 digits."),
  landmark: z.string().optional(),
});

type AgencyFormValues = z.infer<typeof agencySchema>;

export function AddAgencyDialog({ isOpen, onOpenChange, onAgencyAdd }: AddAgencyDialogProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const placeSearchRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<AgencyFormValues>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      addressTitle: '',
      address: '',
      city: '',
      pincode: '',
      landmark: '',
    }
  });

  const resetForm = () => {
    form.reset();
    setImagePreview(null);
    setImageFile(null);
    setShowMap(false);
    if(fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    } else {
      // Force input to remount when modal opens
      setInputKey(prev => prev + 1);
    }
    onOpenChange(open);
  };
  
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processSubmit = async (values: AgencyFormValues) => {
    const success = await onAgencyAdd(values, imageFile || undefined);
    if (success) {
      handleOpenChange(false);
    }
  };

  useEffect(() => {
    const GOOGLE_MAPS_APIKEY = 'AIzaSyBXNyT9zcGdvhAUCUEYTm6e_qPw26AOPgI';
    if (!isOpen) return;
    let autocompleteListener: any;
    let mapClickListener: any;
    let observer: MutationObserver | null = null;
    let styleElement: HTMLStyleElement | null = null;
    let autocompleteInstance: any = null;
    let focusHandler: (() => void) | null = null;
    
    // Check if style element already exists, if not create it
    let existingStyle = document.getElementById('google-places-autocomplete-fix');
    if (!existingStyle) {
      styleElement = document.createElement('style');
      styleElement.id = 'google-places-autocomplete-fix';
      styleElement.textContent = `
        .pac-container {
          z-index: 10000 !important;
          position: absolute !important;
        }
        .pac-item {
          cursor: pointer !important;
          padding: 8px 12px !important;
        }
        .pac-item:hover {
          background-color: #f0f0f0 !important;
        }
        .pac-item-selected {
          background-color: #e0e0e0 !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
    
    (async () => {
      await loadGooglePlaces(GOOGLE_MAPS_APIKEY);
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Clean up any existing pac-container
      const existingPacContainer = document.querySelector('.pac-container');
      if (existingPacContainer) {
        existingPacContainer.remove();
      }
      
      // Setup autocomplete
      if (placeSearchRef.current) {
          // Function to fix pac-container z-index and pointer events
          const clickHandler = (e: Event) => {
            e.stopPropagation();
          };
          
          const fixPacContainer = () => {
            const pacContainer = document.querySelector('.pac-container') as HTMLElement;
            if (pacContainer && !pacContainer.dataset.fixed) {
              pacContainer.dataset.fixed = 'true';
              pacContainer.style.zIndex = '10000';
              pacContainer.style.position = 'absolute';
              pacContainer.style.pointerEvents = 'auto';
              
              // Prevent clicks on pac-container from closing the modal
              pacContainer.addEventListener('click', clickHandler, true);
              pacContainer.addEventListener('mousedown', clickHandler, true);
              
              // Ensure all items are clickable
              const items = pacContainer.querySelectorAll('.pac-item');
              items.forEach((item: any) => {
                if (!item.dataset.fixed) {
                  item.dataset.fixed = 'true';
                  item.style.pointerEvents = 'auto';
                  item.style.cursor = 'pointer';
                  // Prevent click from propagating to overlay
                  item.addEventListener('click', clickHandler, true);
                  item.addEventListener('mousedown', clickHandler, true);
                }
              });
            }
          };
        
        const ac = createAutocomplete(placeSearchRef.current, { 
          componentRestrictions: { country: 'in' },
          types: ['geocode', 'establishment']
        });
        
        if (ac) {
          autocompleteInstance = ac;
          
          // Initial fix
          setTimeout(fixPacContainer, 100);
          
          // Monitor for pac-container creation and fix it
          observer = new MutationObserver(() => {
            fixPacContainer();
          });
          
          observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
          });
          
          // Also listen to input focus to ensure dropdown is ready
          focusHandler = () => {
            setTimeout(fixPacContainer, 100);
          };
          placeSearchRef.current.addEventListener('focus', focusHandler);
          
          autocompleteListener = ac.addListener('place_changed', () => {
            try {
              const place = ac.getPlace();
              console.log('Place object:', place);
              
              if (place) {
                const parsed = parsePlace(place);
                console.log('Parsed place:', parsed);
                
                // Fill form fields with selected place data
                if (parsed.title) {
                  form.setValue('addressTitle', parsed.title, { shouldValidate: true });
                }
                if (parsed.address) {
                  form.setValue('address', parsed.address, { shouldValidate: true });
                }
                if (parsed.city) {
                  form.setValue('city', parsed.city, { shouldValidate: true });
                }
                if (parsed.pincode) {
                  form.setValue('pincode', parsed.pincode, { shouldValidate: true });
                }
                if (parsed.landmark) {
                  form.setValue('landmark', parsed.landmark, { shouldValidate: false });
                }
                
                // Also update the search input value
                if (placeSearchRef.current && place.formatted_address) {
                  placeSearchRef.current.value = place.formatted_address;
                } else if (placeSearchRef.current && parsed.address) {
                  placeSearchRef.current.value = parsed.address;
                }
                
                // Trigger form validation
                form.trigger(['addressTitle', 'address', 'city', 'pincode']);
              }
            } catch (error) {
              console.error('Error handling place_changed:', error);
            }
          });
        }
      }

      // Setup map
      if (showMap && mapContainerRef.current) {
        const map = createMap(mapContainerRef.current);
        if (map) {
          mapClickListener = addMapClickListener(map, async (lat: number, lng: number) => {
            const parsed = await reverseGeocode(lat, lng);
            if (parsed.title) form.setValue('addressTitle', parsed.title, { shouldValidate: true });
            if (parsed.address) form.setValue('address', parsed.address, { shouldValidate: true });
            if (parsed.city) form.setValue('city', parsed.city, { shouldValidate: true });
            if (parsed.pincode) form.setValue('pincode', parsed.pincode, { shouldValidate: true });
            if (parsed.landmark) form.setValue('landmark', parsed.landmark, { shouldValidate: false });
            setShowMap(false);
          });
        }
      }
    })();
    
    return () => {
      try { 
        if (autocompleteListener && autocompleteListener.remove) {
          autocompleteListener.remove();
        }
      } catch {}
      try { 
        if (mapClickListener && mapClickListener.remove) {
          mapClickListener.remove();
        }
      } catch {}
      if (observer) {
        observer.disconnect();
      }
      if (focusHandler && placeSearchRef.current) {
        placeSearchRef.current.removeEventListener('focus', focusHandler);
      }
      // Clean up existing pac-container when modal closes
      const existingPacContainer = document.querySelector('.pac-container');
      if (existingPacContainer) {
        existingPacContainer.remove();
      }
      // Don't remove style element as it's shared, but we can keep it
      // Only remove if we created it and it's not needed elsewhere
      // For now, we'll keep it to avoid flickering
    };
  }, [isOpen, form, showMap]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[95vh] flex flex-col p-0 gap-0"
        onInteractOutside={(e) => {
          // Prevent closing when clicking on pac-container
          const target = e.target as HTMLElement;
          if (target.closest('.pac-container')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>Create a New Agency</DialogTitle>
          <DialogDescription>
            Enter the details below to create a new agency.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(processSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6" style={{ overflowX: 'visible' }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 py-4">
                 <div className="md:col-span-1 flex flex-col items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-24 w-24 sm:h-32 sm:w-32 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <AvatarImage src={imagePreview ?? undefined} />
                        <AvatarFallback>{form.watch('name')?.charAt(0) || 'A'}</AvatarFallback>
                      </Avatar>
                      {imagePreview && (
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={handleRemoveImage}
                          className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/10 hover:bg-gray-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                     <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto">
                       Upload Image
                     </Button>
                 </div>
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormItem className="col-span-2">
                      <FormLabel>Search location</FormLabel>
                      <FormControl>
                        <div className="relative" style={{ overflow: 'visible', zIndex: 1 }}>
                          <Input 
                            key={`place-search-${inputKey}`}
                            inputMode="search" 
                            placeholder="Search place, area, pincode" 
                            ref={placeSearchRef} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowMap(!showMap)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 z-10"
                          >
                            <MapPin className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </FormControl>
                    </FormItem>
                    {showMap && (
                      <div className="col-span-2">
                        <div className="h-48 sm:h-64 w-full rounded-md border" ref={mapContainerRef} />
                        <p className="text-sm text-gray-600 mt-2">Click on the map to select location</p>
                      </div>
                    )}
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Agency Name <span className="text-red-500">*</span></FormLabel><FormControl><Input placeholder="e.g. Bharat Gas" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email <span className="text-red-500">*</span></FormLabel><FormControl><Input type="email" placeholder="e.g. contact@bharat.com" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone <span className="text-red-500">*</span></FormLabel><FormControl><Input type="tel" placeholder="e.g. 9876543210" {...field} maxLength={10} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="addressTitle" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Address Title <span className="text-red-500">*</span></FormLabel><FormControl><Input placeholder="e.g. Head Office" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="address" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Address <span className="text-red-500">*</span></FormLabel><FormControl><Input placeholder="e.g. 123 Main Street" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City <span className="text-red-500">*</span></FormLabel><FormControl><Input placeholder="e.g. Delhi" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="pincode" render={({ field }) => ( <FormItem><FormLabel>Pincode <span className="text-red-500">*</span></FormLabel><FormControl><Input placeholder="e.g. 110001" {...field} maxLength={6} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="landmark" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Landmark</FormLabel><FormControl><Input placeholder="e.g. Near India Gate" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </div>
              </div>
            </div>
            <DialogFooter className="px-6 pt-4 pb-6 flex-shrink-0 border-t bg-muted/40">
              <DialogClose asChild>
                <Button variant="outline" type="button" className="w-full sm:w-auto">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                {form.formState.isSubmitting ? 'Creating...' : 'Create Agency'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
