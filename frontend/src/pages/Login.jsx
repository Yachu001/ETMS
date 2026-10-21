import React, { useState } from 'react';
import api from '../api/axios';
import { KeyRound, Lock, User, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password / OTP modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [otpStep, setOtpStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [modalMsg, setModalMsg] = useState({ text: '', type: '' });

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
    e.preventDefault();
    setModalMsg({ text: '', type: '' });
    try {
      await api.post('/auth/password-reset/otp/', { email: resetEmail });
      setOtpStep(2);
      setModalMsg({ text: 'OTP dispatched! Check your Django server console terminal.', type: 'info' });
    } catch (err) {
      setModalMsg({ text: 'Error dispatching recovery OTP. Check email format.', type: 'error' });
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setModalMsg({ text: '', type: '' });
    try {
      await api.post('/auth/password-reset/verify/', {
        email: resetEmail,
        otp_code: otpCode,
        new_password: newPassword,
      });
      alert('Password reset successfully! Please sign in with your new password.');
      setShowForgotModal(false);
      setOtpStep(1);
    } catch (err) {
      setModalMsg({ text: err.response?.data?.detail || 'Invalid or expired OTP code.', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 mb-3 border border-blue-500/30">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TeamPulse</h1>
          <p className="text-xs text-slate-400 mt-1">Enterprise Work & Task Management</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User size={16} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. yahya"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => { setShowForgotModal(true); setOtpStep(1); setModalMsg({ text: '', type: '' }); }}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-700/60 text-center text-xs text-slate-500">
          Internal access strictly governed by Organization Leads
        </div>
      </div>

      {/* Forgot Password OTP Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-white font-bold mb-1">
              <KeyRound className="text-blue-400" size={18} />
              <h3>Password Recovery</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {otpStep === 1 
                ? 'Enter your corporate email to generate a 6-digit recovery OTP.'
                : 'Enter the 6-digit code and choose your new password.'}
            </p>

            {modalMsg.text && (
              <div className={`mb-4 p-2.5 rounded text-xs border ${
                modalMsg.type === 'error' 
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}>
                {modalMsg.text}
              </div>
            )}

            {otpStep === 1 ? (
              <form onSubmit={handleRequestOTP} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Corporate Email</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Mail size={15} />
                    </span>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="user@company.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-1.5 rounded font-medium"
                  >
                    Request Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">6-Digit Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white text-center font-mono tracking-widest text-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOtpStep(1)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-1.5 rounded font-medium"
                  >
                    Confirm Reset
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