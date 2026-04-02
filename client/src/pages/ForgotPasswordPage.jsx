import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authAPI.sendForgotPasswordOtp({ email: email.trim() });
      setSuccess(response.data?.message || 'OTP sent to your email');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authAPI.verifyForgotPasswordOtp({
        email: email.trim(),
        otp: otp.trim(),
      });

      setResetToken(response.data?.resetToken || '');
      setSuccess('OTP verified. You can set your new password now.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.resetPasswordWithOtp({
        email: email.trim(),
        resetToken,
        newPassword,
      });

      setSuccess(response.data?.message || 'Password reset successful');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full editorial-card p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#0F766E] font-semibold text-center">Account Recovery</p>
        <h2 className="mt-3 text-center text-3xl font-extrabold text-gray-900">
          Forgot Password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          <Link to="/login" className="font-semibold text-[#E4572E] hover:brightness-90">
            Back to Sign in
          </Link>
        </p>

        {error && (
          <div className="mt-6 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-md text-sm">
            {success}
          </div>
        )}

        {step === 1 && (
          <form className="mt-6 space-y-4" onSubmit={handleSendOtp}>
            <label className="block text-sm font-medium text-gray-700" htmlFor="email">
              Enter your account email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#E4572E] focus:border-[#E4572E]"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 text-sm font-semibold rounded-md text-white bg-[#E4572E] hover:brightness-95 disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form className="mt-6 space-y-4" onSubmit={handleVerifyOtp}>
            <label className="block text-sm font-medium text-gray-700" htmlFor="otp">
              Enter 6-digit OTP sent to {email}
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#E4572E] focus:border-[#E4572E] tracking-[0.3em]"
              placeholder="000000"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 text-sm font-semibold rounded-md text-white bg-[#E4572E] hover:brightness-95 disabled:opacity-50"
            >
              {loading ? 'Verifying OTP...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setStep(1)}
              className="w-full py-2 px-4 text-sm font-semibold rounded-md text-[#1F2937] bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              Change Email
            </button>
          </form>
        )}

        {step === 3 && (
          <form className="mt-6 space-y-4" onSubmit={handleResetPassword}>
            <label className="block text-sm font-medium text-gray-700" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#E4572E] focus:border-[#E4572E]"
              placeholder="At least 8 characters"
            />

            <label className="block text-sm font-medium text-gray-700" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#E4572E] focus:border-[#E4572E]"
              placeholder="Repeat password"
            />

            <button
              type="submit"
              disabled={loading || !resetToken}
              className="w-full py-2 px-4 text-sm font-semibold rounded-md text-white bg-[#E4572E] hover:brightness-95 disabled:opacity-50"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
