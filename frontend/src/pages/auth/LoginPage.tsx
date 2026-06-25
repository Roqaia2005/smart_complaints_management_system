import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Shield, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {


      setIsLoading(false);
      navigate('/');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0c10] overflow-hidden relative">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />

      <Card className="w-full max-w-md bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl animate-in">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <Shield className="text-white" size={28} />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-white">Welcome Back</CardTitle>
          <CardDescription className="text-slate-400">
            Enter your credentials to access the workflow engine
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                <Input
                  type="email"
                  placeholder="name@company.com"
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-primary"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-primary"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 border-t border-white/10 pt-6">
          <div className="text-sm text-slate-400 text-center">
            Don't have an account? <a href="#" className="text-primary hover:underline">Request access</a>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            <div className="p-2 border border-white/5 rounded text-center">Demo: admin@test.com</div>
            <div className="p-2 border border-white/5 rounded text-center">Demo: user@test.com</div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
