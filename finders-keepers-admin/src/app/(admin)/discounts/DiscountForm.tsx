'use client';

import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Info } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import MultiSelect from '@/components/ui/MultiSelect';
import { categoriesApi, discountsApi, productsApi } from '@/lib/api';
import type { Category, Discount, PaginatedResponse, Product } from '@/types';

const schema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    description: z.string().optional(),
    publicLabel: z.string().optional(),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.coerce.number().positive('Value must be greater than 0'),
    startsAt: z.string().min(1, 'Start date is required'),
    endsAt: z.string().optional(),
    isActive: z.boolean().optional(),
    minOrderAmount: z.coerce.number().min(0).optional().or(z.literal('')),
    maxDiscountAmount: z.coerce.number().min(0).optional().or(z.literal('')),
    priority: z.coerce.number().int().min(0).max(1000).optional(),
    stackable: z.boolean().optional(),
    productIds: z.array(z.string()),
    variantIds: z.array(z.string()),
    categoryIds: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    // Mirrors the API rule: a percentage cannot exceed 100.
    if (data.type === 'PERCENTAGE' && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'A percentage discount cannot exceed 100%',
      });
    }

    if (data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'End date must be after the start date',
      });
    }

    if (!data.productIds.length && !data.variantIds.length && !data.categoryIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productIds'],
        message: 'Target at least one product, variant or category',
      });
    }
  });

type FormData = z.infer<typeof schema>;

interface DiscountFormProps {
  discount?: Discount;
  onSuccess: () => void;
}

/** datetime-local wants "YYYY-MM-DDTHH:mm". */
function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DiscountForm({ discount, onSuccess }: DiscountFormProps) {
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = !!discount;

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: categoriesApi.findAll,
  });

  // Enough to target from; the picker is searchable.
  const { data: products } = useQuery<PaginatedResponse<Product>>({
    queryKey: ['products', 'for-discount'],
    queryFn: () => productsApi.findAll({ limit: 200 }),
  });

  const targets = discount?.targets ?? [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: discount?.name ?? '',
      description: discount?.description ?? '',
      publicLabel: discount?.publicLabel ?? '',
      type: discount?.type ?? 'PERCENTAGE',
      value: discount?.value ?? 10,
      startsAt: toLocalInput(discount?.startsAt) || toLocalInput(new Date().toISOString()),
      endsAt: toLocalInput(discount?.endsAt),
      isActive: discount?.isActive ?? true,
      minOrderAmount: discount?.minOrderAmount ?? '',
      maxDiscountAmount: discount?.maxDiscountAmount ?? '',
      priority: discount?.priority ?? 0,
      stackable: discount?.stackable ?? false,
      productIds: targets.filter((t) => t.productId).map((t) => t.productId as string),
      variantIds: targets.filter((t) => t.variantId).map((t) => t.variantId as string),
      categoryIds: targets.filter((t) => t.categoryId).map((t) => t.categoryId as string),
    },
  });

  const type = watch('type');
  const stackable = watch('stackable');

  const categoryOptions = useMemo(
    () => (categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const productOptions = useMemo(
    () => (products?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [products],
  );

  const variantOptions = useMemo(
    () =>
      (products?.data ?? []).flatMap((p) =>
        (p.variants ?? []).map((v) => ({
          value: v.id,
          label: v.name ? `${p.name} - ${v.name}` : p.name,
          hint: v.sku ?? undefined,
        })),
      ),
    [products],
  );

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setSubmitError(null);

    const payload: Record<string, unknown> = {
      name: data.name,
      description: data.description || undefined,
      publicLabel: data.publicLabel || undefined,
      type: data.type,
      value: data.value,
      startsAt: new Date(data.startsAt).toISOString(),
      endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : undefined,
      isActive: data.isActive,
      minOrderAmount: data.minOrderAmount === '' ? undefined : Number(data.minOrderAmount),
      maxDiscountAmount:
        data.maxDiscountAmount === '' ? undefined : Number(data.maxDiscountAmount),
      priority: data.priority ?? 0,
      stackable: !!data.stackable,
      productIds: data.productIds,
      variantIds: data.variantIds,
      categoryIds: data.categoryIds,
    };

    try {
      if (isEditing) {
        await discountsApi.update(discount.id, payload);
      } else {
        await discountsApi.create(payload);
      }
      onSuccess();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message ?? 'Could not save the discount.';
      setSubmitError(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-5">
      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input label="Name (internal)" placeholder="Summer Sale" error={errors.name?.message} {...register('name')} />
        <Input label="Public Label" placeholder="-20% Summer" {...register('publicLabel')} />
      </div>

      <Textarea label="Internal Description" placeholder="Not shown to customers..." {...register('description')} />

      <div className="grid grid-cols-3 gap-4">
        <Select
          label="Type"
          options={[
            { value: 'PERCENTAGE', label: 'Percentage (%)' },
            { value: 'FIXED', label: 'Fixed amount' },
          ]}
          {...register('type')}
        />
        <Input
          label={type === 'PERCENTAGE' ? 'Value (%)' : 'Value (amount off)'}
          type="number"
          step="0.01"
          min="0"
          error={errors.value?.message}
          {...register('value')}
        />
        <Input
          label="Priority"
          type="number"
          min="0"
          max="1000"
          error={errors.priority?.message}
          {...register('priority')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Starts At" type="datetime-local" error={errors.startsAt?.message} {...register('startsAt')} />
        <Input
          label="Ends At (blank = no end)"
          type="datetime-local"
          error={errors.endsAt?.message}
          {...register('endsAt')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Minimum Order Amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="Optional"
          {...register('minOrderAmount')}
        />
        <Input
          label="Maximum Discount Amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="Optional cap"
          {...register('maxDiscountAmount')}
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="rounded" {...register('isActive')} />
          <span className="text-sm font-medium text-slate-700">Active</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="rounded" {...register('stackable')} />
          <span className="text-sm font-medium text-slate-700">Stackable</span>
        </label>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <p className="text-xs text-slate-600">
          When several discounts hit the same item, the <strong>highest priority</strong> one
          applies.{' '}
          {stackable
            ? 'Because this one is stackable, other stackable discounts can combine with it, applied in priority order.'
            : 'Because this one is not stackable, it applies alone and never combines.'}
        </p>
      </div>

      {/* Targeting */}
      <div className="space-y-4 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Targets</h3>

        <Controller
          control={control}
          name="categoryIds"
          render={({ field }) => (
            <MultiSelect
              label="Categories"
              options={categoryOptions}
              value={field.value ?? []}
              onChange={field.onChange}
              placeholder="Search categories..."
            />
          )}
        />

        <Controller
          control={control}
          name="productIds"
          render={({ field }) => (
            <MultiSelect
              label="Products"
              options={productOptions}
              value={field.value ?? []}
              onChange={field.onChange}
              placeholder="Search products..."
              error={errors.productIds?.message as string | undefined}
            />
          )}
        />

        <Controller
          control={control}
          name="variantIds"
          render={({ field }) => (
            <MultiSelect
              label="Specific Variants"
              options={variantOptions}
              value={field.value ?? []}
              onChange={field.onChange}
              placeholder="Search variants..."
            />
          )}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-2">
        <Button type="submit" loading={loading}>
          {isEditing ? 'Save Changes' : 'Create Discount'}
        </Button>
      </div>
    </form>
  );
}
