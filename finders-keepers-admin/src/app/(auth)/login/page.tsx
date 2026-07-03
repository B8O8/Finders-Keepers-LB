'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, Mail, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.admin, res.accessToken, res.refreshToken);
      toast('Welcome back!', 'success');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Invalid credentials';
      toast(msg, 'error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="px-8 py-10">
            {/* Logo */}
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-200">
                <Search size={24} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Finders Keepers</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in to your admin account</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="admin@example.com"
                leftIcon={<Mail size={16} />}
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                leftIcon={<Lock size={16} />}
                error={errors.password?.message}
                {...register('password')}
              />
              <Button
                type="submit"
                className="w-full mt-2"
                size="lg"
                loading={isSubmitting}
              >
                Sign in
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Finders Keepers. All rights reserved.
        </p>
      </div>
    </div>
  );
}
