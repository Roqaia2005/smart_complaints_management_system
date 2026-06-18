import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  ShieldCheck,
  ChevronRight,
  Fingerprint,
  KeyRound,
  Mail,
  ArrowLeft,
  Smartphone,
  IdCard,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export default function RegisterPage() {
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  const nextStep = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(prev => prev + 1);
    }, 1000);
  };

  const handleFinish = () => {
    setLoading(true);
    setTimeout(() => {
      navigate('/login');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <Link to="/login" className="inline-flex items-center text-slate-500 hover:text-white transition-colors mb-6 text-sm font-medium">
            <ArrowLeft size={16} className="mr-2" /> Back to login
          </Link>
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-slate-500 mt-2">Join UniResolve to manage your campus experience</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                step === s ? "w-8 bg-blue-600" : "w-4 bg-slate-800"
              )}
            />
          ))}
        </div>

        <Card className="bg-slate-900/50 border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">University Identity</h3>
                    <p className="text-sm text-slate-500">Enter your official ID number provided by the university.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <IdCard className="absolute left-3 top-3 text-slate-500" size={18} />
                      <Input
                        placeholder="202100XXX"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                  <Button onClick={nextStep} className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold" disabled={loading}>
                    {loading ? "Verifying ID..." : "Verify ID"} <ChevronRight size={18} className="ml-2" />
                  </Button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2 text-center">
                    <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Smartphone size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">OTP Verification</h3>
                    <p className="text-sm text-slate-500">We've sent a code to your registered mobile ending in ****84.</p>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <Input
                        key={i}
                        className="h-14 text-center text-xl font-bold bg-white/5 border-white/10 text-white focus:ring-blue-600"
                        maxLength={1}
                      />
                    ))}
                  </div>
                  <div className="text-center">
                    <button className="text-xs font-bold text-blue-500 hover:underline">Resend Code</button>
                  </div>
                  <Button onClick={nextStep} className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold" disabled={loading}>
                    {loading ? "Confirming..." : "Confirm Code"}
                  </Button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">Secure Access</h3>
                    <p className="text-sm text-slate-500">Create a strong password for your account.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 text-slate-500" size={18} />
                      <Input
                        type="password"
                        placeholder="New Password"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white focus:ring-blue-600"
                      />
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 text-slate-500" size={18} />
                      <Input
                        type="password"
                        placeholder="Confirm Password"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white focus:ring-blue-600"
                      />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-[10px] uppercase">
                      <Fingerprint size={12} /> Security Tip
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Use a combination of uppercase, numbers, and special characters to ensure maximum protection.
                    </p>
                  </div>
                  <Button onClick={handleFinish} className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold" disabled={loading}>
                    {loading ? "Completing Registration..." : "Complete Setup"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-600 font-medium px-4">
          By registering, you agree to our <a href="#" className="text-slate-400 underline">Terms of Service</a> and <a href="#" className="text-slate-400 underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
