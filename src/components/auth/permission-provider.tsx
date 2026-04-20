"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";

type PermissionContextValue = {
  permissions: Set<string>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: ReactNode;
}) {
  const value = useMemo<PermissionContextValue>(() => {
    const permissionSet = new Set(permissions);
    return {
      permissions: permissionSet,
      hasPermission: (permission: string) => permissionSet.has(permission),
      hasAnyPermission: (items: string[]) => items.some((permission) => permissionSet.has(permission)),
    };
  }, [permissions]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermission(permission: string) {
  const context = useContext(PermissionContext);
  return context?.hasPermission(permission) ?? false;
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  return context ?? {
    permissions: new Set<string>(),
    hasPermission: () => false,
    hasAnyPermission: () => false,
  };
}

export function CanDo({
  permission,
  any,
  fallback = null,
  children,
}: {
  permission?: string;
  any?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const allowed = permission ? hasPermission(permission) : any ? hasAnyPermission(any) : false;
  return allowed ? <>{children}</> : <>{fallback}</>;
}
