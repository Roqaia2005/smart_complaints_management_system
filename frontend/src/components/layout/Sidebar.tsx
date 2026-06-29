import React from 'react';
import {
  LayoutDashboard, MessageSquare, ListTodo, BarChart3,
  Users, ShieldAlert, History, FileText, Activity, LogOut,
  Map, Lightbulb, FileSearch, Lock, User, ChartBar, Shield, KeyRound,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { WorkflowRole } from '../../types/workflow';
import { useAuthStore } from '../../store/authStore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar as SidebarUI,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import logo from '@/assets/white logo.svg';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: WorkflowRole[];
}

const navItems: NavItem[] = [
  // Student
  { label: 'UniResolve AI',   icon: MessageSquare,  path: '/student/chat',            roles: ['student']     },
  { label: 'My Complaints',   icon: History,         path: '/student/complaints',      roles: ['student']     },
  // Officer
  { label: 'Dashboard',       icon: LayoutDashboard, path: '/officer/dashboards',      roles: ['officer']     },
  { label: 'Appeals',         icon: ShieldAlert,     path: '/officer/appeals',         roles: ['officer']     },
  // Manager
  { label: 'Overview',        icon: Activity,        path: '/manager/overview',        roles: ['manager']     },
  { label: 'Dashboard',       icon: ChartBar,        path: '/manager/analytics',       roles: ['manager']     },
  { label: 'Analytics',       icon: Map,             path: '/manager/heatmap',         roles: ['manager']     },
  { label: 'Recommendations', icon: Lightbulb,       path: '/manager/recommendations', roles: ['manager']     },
  { label: 'Reports',         icon: FileText,        path: '/manager/reports',         roles: ['manager']     },
  { label: 'Top Issues',      icon: ListTodo,        path: '/manager/top-issues',      roles: ['manager']     },
  // Admin
  { label: 'Categories',      icon: ListTodo,        path: '/admin/categories',        roles: ['admin']       },
  { label: 'Users',           icon: Users,           path: '/admin/users',             roles: ['admin']       },
  { label: 'Regulations',     icon: FileSearch,      path: '/admin/regulations',       roles: ['admin']       },
  { label: 'Priority Rules',  icon: Lock,            path: '/admin/priority-rules',    roles: ['admin']       },
  { label: 'Audit Logs',      icon: FileSearch,      path: '/admin/audit-logs',        roles: ['admin']       },
  { label: 'Insights',        icon: BarChart3,       path: '/admin/insights',          roles: ['admin']       },
  // Super Admin
  { label: 'Requests',        icon: Shield,          path: '/superadmin/requests',     roles: ['super_admin'] },
  { label: 'All Admins',      icon: Users,           path: '/superadmin/admins',       roles: ['super_admin'] },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const location  = useLocation();
  const navigate  = useNavigate();
  const { state } = useSidebar();
  const isExpanded = state === 'expanded';

  const role = (user?.role ?? 'student') as WorkflowRole;
  const filteredNavItems = navItems.filter((item) => item.roles.includes(role));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const displayName =
    (user as any)?.full_name ||
    user?.name ||
    user?.email?.split('@')[0] ||
    'User';

  const displayInitial = displayName.charAt(0).toUpperCase();

  const roleLabel: Record<string, string> = {
    student: 'Student', officer: 'Officer', manager: 'Manager',
    admin: 'Admin', super_admin: 'Super Admin',
  };

  return (
    <SidebarUI className="border-r border-sidebar-border bg-sidebar">

      {/* Header */}
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-3 transition-all duration-300">
            <div className="flex aspect-square size-8 items-center justify-center p-1 rounded-lg bg-blue-600 text-sidebar-primary-foreground shadow-lg shadow-blue-600/20">
              <img src={logo} alt="UniResolve" />
            </div>
            {isExpanded && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold text-sidebar-foreground">UniResolve</span>
                <span className="truncate text-xs text-sidebar-foreground/60">Campus Management</span>
              </div>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 font-bold uppercase tracking-widest text-[10px]">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        'h-10 transition-all duration-200',
                        isActive
                          ? 'bg-blue-600/10 text-blue-500 hover:bg-blue-600/15'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      )}
                    >
                      <Link to={item.path} className="flex items-center gap-3 w-full">
                        <item.icon className={cn(
                          'size-5 shrink-0 transition-colors',
                          isActive ? 'text-blue-500' : 'text-sidebar-foreground/40',
                        )} />
                        <span className="font-medium text-sm truncate">{item.label}</span>
                        {isActive && isExpanded && (
                          <div className="ml-auto size-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Account section — replaces Settings */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-sidebar-foreground/40 font-bold uppercase tracking-widest text-[10px]">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Change Password"
                  isActive={location.pathname === '/change-password'}
                  className={cn(
                    'h-10 transition-all duration-200',
                    location.pathname === '/change-password'
                      ? 'bg-blue-600/10 text-blue-500 hover:bg-blue-600/15'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )}
                >
                  <Link to="/change-password" className="flex items-center gap-3 w-full">
                    <KeyRound className={cn(
                      'size-5 shrink-0 transition-colors',
                      location.pathname === '/change-password'
                        ? 'text-blue-500'
                        : 'text-sidebar-foreground/40',
                    )} />
                    <span className="font-medium text-sm">Change Password</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — real user name + role + logout */}
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar-background/50 p-4">
        <div className="flex items-center gap-3 overflow-hidden">

          {/* Avatar initial */}
          <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent border border-sidebar-border text-sidebar-foreground font-bold text-sm select-none">
            {displayInitial || <User className="size-4" />}
          </div>

          {/* Name + role label */}
          {isExpanded && (
            <div className="grid flex-1 text-left text-sm leading-tight overflow-hidden">
              <span className="truncate font-bold text-sidebar-foreground" title={displayName}>
                {displayName}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/50 font-medium">
                {roleLabel[role] ?? role}
              </span>
            </div>
          )}

          {/* Logout */}
          {isExpanded && (
            <button
              onClick={handleLogout}
              title="Sign out"
              className="ml-auto size-8 flex items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </SidebarFooter>
    </SidebarUI>
  );
}