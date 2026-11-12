// frontend/src/pages/Login.jsx

import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  KeyRound, 
  Lock, 
  User, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Clock, 
  RefreshCw 
} from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password / OTP modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [otpStep, setOtpStep] = useState(1); // 1 = request, 2 = verify
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [modalMsg, setModalMsg] = useState({ text: '', type: '' });
  const [otpLoading, setOtpLoading] = useState(false);

  // Cooldown timer state (in seconds)
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer = null;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/token/', { username, password });
      const { access, refresh, user } = res.data;
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user));
      
      onLoginSuccess(user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e) => {
    if (e) e.preventDefault();
    if (cooldown > 0 || otpLoading) return;

    setModalMsg({ text: '', type: '' });
    setOtpLoading(true);

    try {
      const res = await api.post('/auth/password-reset/otp/', { 
        email: resetEmail.trim().toLowerCase() 
      });
      
      setOtpStep(2);
      setModalMsg({ 
        text: res.data?.detail || 'A 6-digit verification code has been dispatched to your email.', 
        type: 'info' 
      });
      setCooldown(120); // 2-minute cooldown
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      if (err.response?.status === 404) {
        setModalMsg({ 
          text: errorDetail || 'No user account exists with this email address.', 
          type: 'error' 
        });
      } else if (err.response?.status === 429) {
        setModalMsg({ 
          text: errorDetail || 'An OTP was dispatched recently. Please wait before retrying.', 
          type: 'error' 
        });
      } else {
        setModalMsg({ 
          text: errorDetail || 'Unable to dispatch verification email. Please check the email format.', 
          type: 'error' 
        });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setModalMsg({ text: '', type: '' });
    setOtpLoading(true);

    try {
      await api.post('/auth/password-reset/verify/', {
        email: resetEmail.trim().toLowerCase(),
        otp_code: otpCode.trim(),
        new_password: newPassword,
      });
      
      alert('Password reset successfully! Please sign in with your new password.');
      setShowForgotModal(false);
      setOtpStep(1);
      setResetEmail('');
      setOtpCode('');
      setNewPassword('');
      setCooldown(0);
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Invalid or expired OTP code.';
      
      if (data?.detail) {
        msg = data.detail;
      } else if (data?.new_password) {
        msg = Array.isArray(data.new_password) ? data.new_password[0] : data.new_password;
      } else if (data?.otp_code) {
        msg = Array.isArray(data.otp_code) ? data.otp_code[0] : data.otp_code;
      } else if (typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        msg = `${firstKey}: ${data[firstKey]}`;
      }
      
      setModalMsg({ text: msg, type: 'error' });
    } finally {
      setOtpLoading(false);
    }
  };

  const formatCooldown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-[#EEF2F6] bg-[radial-gradient(ellipse_at_top,_#F8FAFC,_#E2E8F0)] flex items-center justify-center p-4 selection:bg-blue-500/15 selection:text-blue-800">
      
      {/* Soft Ambient Royal Blue Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl opacity-70"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl opacity-70"></div>
      </div>

      {/* Main Login Card */}
      <div className="relative max-w-md w-full bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.08),0_4px_16px_rgba(37,99,235,0.05)] p-8 z-10">
        
        {/* Header / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white mb-3.5 shadow-[0_6px_18px_rgba(37,99,235,0.3)] ring-4 ring-blue-50">
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Team<span className="text-blue-600">Pulse</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Enterprise Work & Task Management</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User size={16} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition"
                placeholder="Enter your username"
              />
            </div>
          </div>

          {/* Password Input with Eye Toggle */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setOtpStep(1);
                  setModalMsg({ text: '', type: '' });
                }}
                className="text-xs text-blue-600 hover:text-blue-700 transition font-semibold cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Lock size={16} />
              </span>
              <input
                type={showLoginPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-600 transition cursor-pointer"
                tabIndex={-1}
              >
                {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-[0_6px_18px_rgba(37,99,235,0.28)] hover:shadow-[0_8px_24px_rgba(37,99,235,0.38)] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center text-xs text-slate-400 font-medium">
          Internal access strictly governed by Organization Leads
        </div>
      </div>

      {/* Forgot Password OTP Recovery Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/90 rounded-3xl max-w-sm w-full p-6 shadow-[0_24px_50px_rgba(15,23,42,0.16)] relative">
            
            <div className="flex items-center gap-2.5 text-slate-900 font-bold mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <KeyRound size={16} />
              </div>
              <h3 className="text-base text-slate-900">Password Recovery</h3>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {otpStep === 1 
                ? 'Enter your registered corporate email to generate a 6-digit recovery OTP.'
                : 'Enter the 6-digit code sent to your inbox along with your new password.'}
            </p>

            {modalMsg.text && (
              <div className={`mb-4 p-3 rounded-xl text-xs border leading-relaxed ${
                modalMsg.type === 'error' 
                  ? 'bg-rose-50 border-rose-200 text-rose-700' 
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                {modalMsg.text}
              </div>
            )}

            {otpStep === 1 ? (
              <form onSubmit={handleRequestOTP} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Corporate Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Mail size={15} />
                    </span>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="user@company.com"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3.5 py-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={otpLoading || cooldown > 0}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs px-4 py-2 rounded-xl font-semibold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                  >
                    {otpLoading ? (
                      'Sending...'
                    ) : cooldown > 0 ? (
                      <>
                        <Clock size={13} />
                        Retry in {formatCooldown(cooldown)}
                      </>
                    ) : (
                      'Request Code'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      6-Digit Code
                    </label>
                    {cooldown > 0 ? (
                      <span className="text-[11px] text-blue-600 font-mono font-semibold flex items-center gap-1">
                        <Clock size={11} /> {formatCooldown(cooldown)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOTP}
                        disabled={otpLoading}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 underline cursor-pointer"
                      >
                        <RefreshCw size={11} /> Resend OTP
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full py-2 bg-blue-50/40 border border-blue-200 rounded-xl text-center font-mono tracking-widest text-lg font-bold text-blue-700 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Lock size={15} />
                    </span>
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-10 pr-10 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-600 transition cursor-pointer"
                      tabIndex={-1}
                    >
                      {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(1);
                      setModalMsg({ text: '', type: '' });
                    }}
                    className="px-3.5 py-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs px-4 py-2 rounded-xl font-semibold transition disabled:opacity-50 cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                  >
                    {otpLoading ? 'Verifying...' : 'Confirm Reset'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}