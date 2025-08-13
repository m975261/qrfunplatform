import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Shield, Lock, Mail, Key } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface LoginStep {
  step: 'login' | 'setup' | 'two-factor' | 'reset-request' | 'reset-confirm';
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<LoginStep['step']>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    newPassword: '',
    confirmPassword: '',
    totpCode: '',
    resetToken: ''
  });
  
  const [tempAdminData, setTempAdminData] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Initial login mutation
  const initialLoginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/admin/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.requiresSetup) {
        setTempAdminData(data.admin);
        setCurrentStep('setup');
        setError('');
      } else {
        setTempAdminData(data.admin);
        setCurrentStep('two-factor');
        setError('');
      }
    },
    onError: (err: any) => {
      setError('Invalid username or password');
    },
  });

  // Setup email and password mutation
  const setupMutation = useMutation({
    mutationFn: async (data: { adminId: string; email: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/admin/setup", data);
      return response.json();
    },
    onSuccess: (data) => {
      setQrCodeUrl(data.qrCode);
      setCurrentStep('two-factor');
      setError('');
      setSuccess('Setup completed! Please scan the QR code with Google Authenticator, then enter the 6-digit code.');
    },
    onError: (err: any) => {
      setError('Setup failed. Please try again.');
    },
  });

  // Two-factor login mutation
  const twoFactorMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; totpCode: string }) => {
      const response = await apiRequest("POST", "/api/admin/verify-2fa", data);
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem('adminToken', data.sessionToken);
      setLocation('/man/dashboard');
    },
    onError: (err: any) => {
      setError('Invalid two-factor authentication code');
    },
  });

  // Password reset request mutation
  const resetRequestMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await apiRequest("POST", "/api/admin/reset-request", data);
      return response.json();
    },
    onSuccess: (data) => {
      setSuccess(data.message);
      setError('');
    },
    onError: (err: any) => {
      setError('Error processing request');
    },
  });

  // Password reset confirm mutation
  const resetConfirmMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string; totpCode: string }) => {
      const response = await apiRequest("POST", "/api/admin/reset-confirm", data);
      return response.json();
    },
    onSuccess: (data) => {
      setSuccess('Password reset successfully! You can now login.');
      setCurrentStep('login');
      setError('');
      setFormData({ ...formData, password: '', totpCode: '', resetToken: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err: any) => {
      setError('Password reset failed. Please check your two-factor code.');
    },
  });

  const handleInitialLogin = () => {
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    initialLoginMutation.mutate({
      username: formData.username,
      password: formData.password
    });
  };

  const handleSetup = () => {
    if (!formData.email || !formData.newPassword || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setError('');
    setupMutation.mutate({
      adminId: tempAdminData.id,
      email: formData.email,
      newPassword: formData.newPassword
    });
  };

  const handleTwoFactor = () => {
    if (!formData.totpCode || formData.totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    setError('');
    twoFactorMutation.mutate({
      username: formData.username,
      password: currentStep === 'setup' ? formData.newPassword : formData.password,
      totpCode: formData.totpCode
    });
  };

  const handleResetRequest = () => {
    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }
    resetRequestMutation.mutate({ email: formData.email });
  };

  const handleResetConfirm = () => {
    if (!formData.newPassword || !formData.confirmPassword || !formData.totpCode) {
      setError('Please fill in all fields');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (formData.totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || formData.resetToken;
    
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    resetConfirmMutation.mutate({
      token: token,
      newPassword: formData.newPassword,
      totpCode: formData.totpCode
    });
  };

  const renderLoginStep = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-red-600" />
        </div>
        <CardTitle>Admin Login</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Enter username"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        <Button 
          onClick={handleInitialLogin} 
          className="w-full" 
          disabled={initialLoginMutation.isPending}
        >
          {initialLoginMutation.isPending ? 'Signing In...' : 'Sign In'}
        </Button>
        
        <div className="text-center">
          <Button 
            variant="link" 
            onClick={() => setCurrentStep('reset-request')}
            className="text-sm"
          >
            Forgot Password?
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderSetupStep = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Mail className="w-6 h-6 text-blue-600" />
        </div>
        <CardTitle>Initial Setup</CardTitle>
        <p className="text-sm text-gray-600">Complete your admin account setup</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter your email"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              placeholder="Enter new password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            placeholder="Confirm new password"
          />
        </div>
        
        <Button 
          onClick={handleSetup} 
          className="w-full" 
          disabled={setupMutation.isPending}
        >
          {setupMutation.isPending ? 'Setting Up...' : 'Complete Setup'}
        </Button>
      </CardContent>
    </Card>
  );

  const renderTwoFactorStep = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Key className="w-6 h-6 text-green-600" />
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <p className="text-sm text-gray-600">
          {qrCodeUrl ? 'Scan the QR code with Google Authenticator' : 'Enter your 6-digit authentication code'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        {qrCodeUrl && (
          <div className="text-center">
            <img src={qrCodeUrl} alt="QR Code for Google Authenticator" className="mx-auto mb-4" />
            <p className="text-xs text-gray-500 mb-4">
              Scan this QR code with Google Authenticator app, then enter the 6-digit code below
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="totpCode">Authentication Code</Label>
          <Input
            id="totpCode"
            type="text"
            maxLength={6}
            value={formData.totpCode}
            onChange={(e) => setFormData({ ...formData, totpCode: e.target.value.replace(/\D/g, '') })}
            placeholder="Enter 6-digit code"
            className="text-center text-2xl tracking-widest"
          />
        </div>
        
        <Button 
          onClick={handleTwoFactor} 
          className="w-full" 
          disabled={twoFactorMutation.isPending}
        >
          {twoFactorMutation.isPending ? 'Verifying...' : 'Verify & Login'}
        </Button>
        
        <div className="text-center">
          <Button 
            variant="link" 
            onClick={() => setCurrentStep('login')}
            className="text-sm"
          >
            Back to Login
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderResetRequestStep = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-orange-600" />
        </div>
        <CardTitle>Reset Password</CardTitle>
        <p className="text-sm text-gray-600">Enter your email to receive a reset link</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="resetEmail">Email Address</Label>
          <Input
            id="resetEmail"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter your email"
          />
        </div>
        
        <Button 
          onClick={handleResetRequest} 
          className="w-full" 
          disabled={resetRequestMutation.isPending}
        >
          {resetRequestMutation.isPending ? 'Sending...' : 'Send Reset Link'}
        </Button>
        
        <div className="text-center">
          <Button 
            variant="link" 
            onClick={() => setCurrentStep('login')}
            className="text-sm"
          >
            Back to Login
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderResetConfirmStep = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-purple-600" />
        </div>
        <CardTitle>Reset Password</CardTitle>
        <p className="text-sm text-gray-600">Enter your new password and 2FA code</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              placeholder="Enter new password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            placeholder="Confirm new password"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="totpCode">Google Authenticator Code</Label>
          <Input
            id="totpCode"
            type="text"
            maxLength={6}
            value={formData.totpCode}
            onChange={(e) => setFormData({ ...formData, totpCode: e.target.value.replace(/\D/g, '') })}
            placeholder="Enter 6-digit code"
            className="text-center text-2xl tracking-widest"
          />
        </div>
        
        <Button 
          onClick={handleResetConfirm} 
          className="w-full" 
          disabled={resetConfirmMutation.isPending}
        >
          {resetConfirmMutation.isPending ? 'Resetting...' : 'Reset Password'}
        </Button>
      </CardContent>
    </Card>
  );

  // Check for reset token in URL
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setCurrentStep('reset-confirm');
      setFormData(prev => ({ ...prev, resetToken: token }));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {currentStep === 'login' && renderLoginStep()}
        {currentStep === 'setup' && renderSetupStep()}
        {currentStep === 'two-factor' && renderTwoFactorStep()}
        {currentStep === 'reset-request' && renderResetRequestStep()}
        {currentStep === 'reset-confirm' && renderResetConfirmStep()}
      </div>
    </div>
  );
}