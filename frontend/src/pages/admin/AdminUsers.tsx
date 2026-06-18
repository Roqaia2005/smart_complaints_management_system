import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Plus,
  Search,
  Filter,
  UserPlus,
  MoreVertical,
  Mail,
  Shield,
  User as UserIcon,
  Trash2,
  Edit
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';

export default function AdminUsers() {
  const users = [
    { id: '1', name: 'Dr. Sarah Wilson', email: 's.wilson@uni.edu', role: 'manager', dept: 'Facilities', status: 'active' },
    { id: '2', name: 'Eng. Mike Ross', email: 'm.ross@uni.edu', role: 'officer', dept: 'IT Infrastructure', status: 'active' },
    { id: '3', name: 'Ahmed Ali', email: 'a.ali@student.uni.edu', role: 'student', dept: 'Engineering', status: 'active' },
    { id: '4', name: 'System Admin', email: 'admin@uni.edu', role: 'admin', dept: 'Central IT', status: 'active' },
    { id: '5', name: 'Rachel Zane', email: 'r.zane@uni.edu', role: 'officer', dept: 'Academic Affairs', status: 'inactive' },
  ];

  const roleColors: Record<string, string> = {
    admin: 'bg-slate-900 text-white',
    manager: 'bg-purple-600 text-white',
    officer: 'bg-blue-600 text-white',
    student: 'bg-emerald-600 text-white',
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-slate-500 font-medium">Control system access and assign administrative roles</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold h-11 px-6 shadow-lg shadow-blue-500/20">
          <UserPlus size={18} /> Add New User
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <Input placeholder="Search users by name, email, or ID..." className="pl-10 h-10" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2"><Filter size={16} /> Filter Roles</Button>
            <Button variant="outline" size="sm" className="gap-2">Export CSV</Button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/30 border-b dark:border-slate-800">
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Details</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-bold border dark:border-slate-700">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{user.name}</p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Mail size={12} /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={cn("font-bold px-3 py-0.5 rounded-full text-[10px] uppercase tracking-widest", roleColors[user.role])}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-600 dark:text-slate-400">{user.dept}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", user.status === 'active' ? "bg-emerald-500" : "bg-slate-300")} />
                        <span className="text-xs font-bold capitalize">{user.status}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-600 transition-colors">
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-rose-600 transition-colors">
                          <Trash2 size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400">
                          <MoreVertical size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
