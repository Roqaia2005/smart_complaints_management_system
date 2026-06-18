import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../store/authStore';
import { Navigate, Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '../ui/sidebar';
import { ThemeToggle } from './ThemeToggle';

export function MainLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 bg-background  sticky top-0 z-40 justify-between">
          <div className="flex items-center">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border mx-2" />
          </div>
            <ThemeToggle/>
           
          </header>
          <main className="p-8">
            <div className="max-w-7xl mx-auto animate-in">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
