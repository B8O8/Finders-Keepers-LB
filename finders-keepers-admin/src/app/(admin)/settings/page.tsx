'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Save, AlertTriangle, Globe } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { settingsApi } from '@/lib/api';
import { useForm } from 'react-hook-form';

interface SettingsForm {
  storeName: string;
  currency: string;
  deliveryEnabled: boolean;
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number;
  whatsappNumber: string;
  orderMinimumAmount: number;
  maintenanceMode: boolean;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const { register, handleSubmit, reset, watch } = useForm<SettingsForm>();
  const maintenanceMode = watch('maintenanceMode');

  useEffect(() => {
    if (settings) {
      reset({
        storeName: settings.storeName ?? '',
        currency: settings.currency ?? 'USD',
        deliveryEnabled: settings.deliveryEnabled ?? true,
        defaultDeliveryFee: settings.defaultDeliveryFee ?? 0,
        freeDeliveryThreshold: settings.freeDeliveryThreshold ?? 0,
        whatsappNumber: settings.whatsappNumber ?? '',
        orderMinimumAmount: settings.orderMinimumAmount ?? 0,
        maintenanceMode: settings.maintenanceMode ?? false,
      });
    }
  }, [settings, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast('Settings saved', 'success');
    },
    onError: () => toast('Failed to save settings', 'error'),
  });

  const onSubmit = (data: SettingsForm) => {
    updateMutation.mutate({
      ...data,
      deliveryEnabled: Boolean(data.deliveryEnabled),
      maintenanceMode: Boolean(data.maintenanceMode),
      defaultDeliveryFee: Number(data.defaultDeliveryFee) || 0,
      freeDeliveryThreshold: Number(data.freeDeliveryThreshold) || 0,
      orderMinimumAmount: Number(data.orderMinimumAmount) || 0,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" subtitle="Configure your store" />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-4 max-w-2xl">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">

            {/* Store Info */}
            <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <SettingsIcon size={18} className="text-indigo-600" />
                <h2 className="font-semibold text-slate-900">Store Information</h2>
              </div>
              <Input label="Store Name" placeholder="Finders Keepers" {...register('storeName')} />
              <Input label="Currency" placeholder="USD" {...register('currency')} />
              <Input label="WhatsApp Number" placeholder="+96170123456" {...register('whatsappNumber')} />
            </section>

            {/* Delivery */}
            <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-900">Delivery Settings</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded" {...register('deliveryEnabled')} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Enable Delivery</p>
                  <p className="text-xs text-slate-500">Allow customers to receive orders at their address</p>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Default Delivery Fee ($)"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('defaultDeliveryFee', { valueAsNumber: true })}
                />
                <Input
                  label="Free Delivery Threshold ($)"
                  type="number"
                  min="0"
                  step="0.01"
                  hint="Set 0 to disable"
                  {...register('freeDeliveryThreshold', { valueAsNumber: true })}
                />
              </div>
            </section>

            {/* Order */}
            <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-900">Order Settings</h2>
              <Input
                label="Minimum Order Amount ($)"
                type="number"
                min="0"
                step="0.01"
                hint="Set 0 to disable minimum"
                {...register('orderMinimumAmount', { valueAsNumber: true })}
              />
            </section>

            {/* Maintenance */}
            <section className={`rounded-xl border p-5 transition-all ${maintenanceMode ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${maintenanceMode ? 'bg-red-100' : 'bg-slate-100'}`}>
                    <AlertTriangle size={20} className={maintenanceMode ? 'text-red-600' : 'text-slate-400'} />
                  </div>
                  <div>
                    <h2 className={`font-semibold ${maintenanceMode ? 'text-red-900' : 'text-slate-900'}`}>Maintenance Mode</h2>
                    <p className={`text-sm mt-0.5 ${maintenanceMode ? 'text-red-700' : 'text-slate-500'}`}>
                      {maintenanceMode
                        ? '⚠️ Your storefront is currently offline — customers see the maintenance page.'
                        : 'When enabled, all storefront visitors are redirected to a maintenance page.'}
                    </p>
                  </div>
                </div>

                {/* Toggle switch */}
                <label className="relative inline-flex cursor-pointer items-center shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register('maintenanceMode')}
                  />
                  <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-red-500 peer-focus:ring-2 peer-focus:ring-red-300 transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>

              {maintenanceMode && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-4 py-3">
                  <Globe size={14} className="text-red-600 shrink-0" />
                  <p className="text-xs text-red-700">
                    Admins are not affected — only the customer-facing storefront is blocked.
                    Save settings to apply the change.
                  </p>
                </div>
              )}
            </section>

            <Button type="submit" loading={updateMutation.isPending} size="lg">
              <Save size={16} /> Save Settings
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
