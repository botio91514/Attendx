import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap, Loader2 } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const success = await login(email, password);
      if (success) {
        // Retrieve fresh user info from local storage to decide where to go
        const stored = localStorage.getItem('attendx_user');
        const user = stored ? JSON.parse(stored) : null;
        navigate(user?.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      } else {
        setError('Invalid email or password');
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(true); // Keeps button disabled while navigating
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center mesh-gradient">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(244,94%,69%) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />

        <div className="relative z-10 text-center px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-[var(--glow-primary)]">
              <Zap className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-display font-extrabold text-foreground mb-3">AttendX</h1>
            <p className="text-xl text-muted-foreground font-body">Work smarter, track better</p>
          </motion.div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={`w-full max-w-md ${shake ? 'animate-shake' : ''}`}
        >
          <div className="glass-card p-8 md:p-10">
            <h2 className="text-2xl font-display font-bold text-foreground mb-1">Welcome back</h2>
            <p className="text-muted-foreground text-sm mb-8">Sign in to your account</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block font-body">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-floating"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block font-body">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-floating pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-destructive text-sm font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="glow-button w-full flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
};

export default LoginPage;
