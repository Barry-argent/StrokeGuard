"use client";
"use client";

import { useState } from "react";
import Link from "next/link";
import { EyeOff, Eye, Loader2 } from "lucide-react";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { signUp } from "@/lib/actions/auth";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function SignUpPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string[];
    email?: string[];
    password?: string[];
    message?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const result = await signUp(formData);

    if (result?.error) {
      setErrors(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1684752397429-4ce4d7856cb8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwZG9jdG9yJTIwcHJvZmVzc2lvbmFsJTIwc29mdCUyMGxpZ2h0aW5nfGVufDF8fHx8MTc3MTYzMjk2Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Medical professional"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Slightly darker overlay */}
        <div className="absolute inset-0 bg-[#0EA5E9] opacity-25" />
      </div>

      {/* Right Panel - Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-white text-[#0F172A]">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8">
            <Logo size={48} color="#0EA5E9" />
          </div>
          {/* Progress bar */}
          <div className="mb-6">
            <div className="h-1 bg-[#F1F5F9] rounded-full overflow-hidden mb-2">
              <div className="h-full bg-[#0EA5E9] w-[14%] transition-all duration-300" />
            </div>
            <p className="text-[#64748B] text-[11px] tracking-wider font-mono">
              STEP 1 OF 7
            </p>
          </div>

          {/* Heading */}
          <h1 className="text-[26px] font-bold mb-2">
            Create your account
          </h1>

          {/* Subtext */}
          <p className="text-[#64748B] text-[13px] mb-8">
            We'll keep your health data private and on your device.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.message && (
              <div className="p-3 bg-red-50 text-red-500 text-sm rounded-lg">
                {errors.message}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label 
                htmlFor="fullName"
                className="block text-[#374151] text-sm font-medium mb-2"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="w-full h-12 px-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] transition-all"
                placeholder="John Doe"
              />
              {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName[0]}</p>}
            </div>

            {/* Email */}
            <div>
              <label 
                htmlFor="email"
                className="block text-[#374151] text-sm font-medium mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full h-12 px-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] transition-all"
                placeholder="john@example.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email[0]}</p>}
            </div>

            {/* Password */}
            <div>
              <label 
                htmlFor="password"
                className="block text-[#374151] text-sm font-medium mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full h-12 px-4 pr-12 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#64748B]"
                >
                  {showPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password[0]}</p>}
            </div>



            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#0EA5E9] text-white rounded-full text-[15px] font-medium hover:bg-[#0EA5E9]/90 transition-colors mt-6 flex items-center justify-center disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Create Account"
              )}
            </button>

            {/* Terms */}
            <p className="text-center text-[#9CA3AF] text-[11px] mt-4">
              By continuing you agree to our{' '}
              <a href="#" className="text-[#0EA5E9] hover:underline">
                Terms
              </a>
              {' '}and{' '}
              <a href="#" className="text-[#0EA5E9] hover:underline">
                Privacy Policy
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
