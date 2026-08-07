"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, MapPin, Phone, School, User } from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import { getDefaultPathForRole, normalizeRole } from "@/lib/auth/roles";

const categoryOptions = [
  { value: "NURSERY", label: "Nursery" },
  { value: "PRIMARY", label: "Primary" },
  { value: "SECONDARY", label: "Secondary" },
  { value: "COLLEGE", label: "College" },
  { value: "MIXED", label: "Mixed / Multi-level" }
];

function resolveLandingPath(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? getDefaultPathForRole(normalizedRole) : "/dashboard";
}

export function OnboardingForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/v1/onboarding/schools", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          schoolName: formData.get("schoolName"),
          category: formData.get("category"),
          ownerName: formData.get("ownerName"),
          ownerEmail: formData.get("ownerEmail"),
          ownerPhone: formData.get("ownerPhone"),
          password: formData.get("password"),
          address: formData.get("address"),
          city: formData.get("city"),
          state: formData.get("state")
        })
      });

      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { user: { role: string } };
      };

      if (!response.ok || body.ok === false || !body.data) {
        const nextError = body.error ?? "Unable to create your school workspace";
        setError(nextError);
        showToast({
          variant: "error",
          title: "Registration failed",
          description: nextError
        });
        setPending(false);
        return;
      }

      setSuccess(true);
      showToast({
        variant: "success",
        title: "Your school workspace is ready",
        description: "Taking you to your new dashboard now."
      });
      const nextPath = resolveLandingPath(body.data.user.role);

      window.setTimeout(() => {
        router.push(nextPath);
        router.refresh();
      }, 250);
    } catch {
      const nextError =
        "Unable to reach the server. Please make sure the app is running and try again.";
      setError(nextError);
      showToast({
        variant: "error",
        title: "Server unavailable",
        description: nextError
      });
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      method="post"
      className={success ? "grid gap-4 rounded-[20px] ring-2 ring-[var(--color-success)]/40 transition-all" : "grid gap-4"}
    >
      <label>
        <span className="field-label">School name</span>
        <div className="relative mt-2">
          <School className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            name="schoolName"
            required
            minLength={2}
            className="field-control h-12 rounded-2xl pl-11"
            placeholder="Greenfield College"
          />
        </div>
      </label>

      <label>
        <span className="field-label">School type</span>
        <select name="category" defaultValue="MIXED" className="field-control mt-2 h-12 rounded-2xl">
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">Your full name</span>
          <div className="relative mt-2">
            <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              name="ownerName"
              required
              minLength={2}
              className="field-control h-12 rounded-2xl pl-11"
              placeholder="Ifeoma Nwosu"
            />
          </div>
        </label>
        <label>
          <span className="field-label">Phone number</span>
          <div className="relative mt-2">
            <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="tel"
              name="ownerPhone"
              className="field-control h-12 rounded-2xl pl-11"
              placeholder="+234 800 000 0000"
            />
          </div>
        </label>
      </div>

      <label>
        <span className="field-label">Email</span>
        <div className="relative mt-2">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="email"
            name="ownerEmail"
            required
            className="field-control h-12 rounded-2xl pl-11"
            placeholder="you@greenfieldcollege.ng"
          />
        </div>
      </label>

      <label>
        <span className="field-label">Password</span>
        <div className="relative mt-2">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            minLength={8}
            className="field-control h-12 rounded-2xl pl-11 pr-11"
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">City</span>
          <div className="relative mt-2">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input type="text" name="city" className="field-control h-12 rounded-2xl pl-11" placeholder="Lagos" />
          </div>
        </label>
        <label>
          <span className="field-label">State</span>
          <input type="text" name="state" className="field-control mt-2 h-12 rounded-2xl" placeholder="Lagos State" />
        </label>
      </div>

      <label>
        <span className="field-label">School address</span>
        <input type="text" name="address" className="field-control mt-2 h-12 rounded-2xl" placeholder="12 Admiralty Way, Lekki" />
      </label>

      <button type="submit" disabled={pending} className="btn-primary h-12 rounded-2xl text-[14px]">
        <span>{pending ? "Creating your workspace..." : "Create my school workspace"}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-center text-[12px] text-[var(--color-text-muted)]">
        Your workspace is created instantly with a 14-day free trial. No manual approval required.
      </p>
      {error ? <p className="text-[13px] text-[var(--color-danger)]">{error}</p> : null}
    </form>
  );
}
