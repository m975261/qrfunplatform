import bcrypt from "bcryptjs";
import * as speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { db } from "./db";
import { admins, passwordResetTokens, adminSessions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "admin-jwt-secret";
const INITIAL_PASSWORD = "Trilli0n$@P9crkmm6";
const INITIAL_USERNAME = "m975261";

interface AdminAuthService {
  initializeDefaultAdmin(): Promise<void>;
  validateInitialLogin(username: string, password: string): Promise<{ success: boolean; admin?: any; requiresSetup?: boolean }>;
  setupAdminEmail(adminId: string, email: string, newPassword: string): Promise<{ success: boolean; totpSecret?: string; qrCode?: string }>;
  validateLogin(username: string, password: string, totpCode: string): Promise<{ success: boolean; admin?: any; sessionToken?: string }>;
  generatePasswordResetToken(email: string): Promise<{ success: boolean; message: string }>;
  validatePasswordReset(token: string, newPassword: string, totpCode: string): Promise<{ success: boolean; message: string }>;
  validateSession(sessionToken: string): Promise<{ success: boolean; admin?: any }>;
  sendResetEmail(email: string, resetToken: string): Promise<void>;
}

class AdminAuthServiceImpl implements AdminAuthService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Initialize Gmail transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_APP_PASSWORD || ''
      }
    });
  }

  async initializeDefaultAdmin(): Promise<void> {
    try {
      // Check if default admin already exists
      const existingAdmin = await db.select().from(admins).where(eq(admins.username, INITIAL_USERNAME)).limit(1);
      
      if (existingAdmin.length === 0) {
        // Create default admin with initial password
        const hashedPassword = await bcrypt.hash(INITIAL_PASSWORD, 12);
        
        await db.insert(admins).values({
          username: INITIAL_USERNAME,
          passwordHash: hashedPassword,
          isInitialSetup: true,
          emailVerified: false,
        });
        
        console.log('Default admin created successfully');
      }
    } catch (error) {
      console.error('Error initializing default admin:', error);
    }
  }

  async validateInitialLogin(username: string, password: string): Promise<{ success: boolean; admin?: any; requiresSetup?: boolean }> {
    try {
      const admin = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
      
      if (admin.length === 0) {
        return { success: false };
      }

      const adminData = admin[0];

      // Check if this is initial setup
      if (adminData.isInitialSetup && password === INITIAL_PASSWORD) {
        return { success: true, admin: adminData, requiresSetup: true };
      }

      // For non-initial setup, validate regular password
      if (!adminData.isInitialSetup && adminData.passwordHash) {
        const isValidPassword = await bcrypt.compare(password, adminData.passwordHash);
        if (isValidPassword) {
          return { success: true, admin: adminData, requiresSetup: false };
        }
      }

      return { success: false };
    } catch (error) {
      console.error('Error in validateInitialLogin:', error);
      return { success: false };
    }
  }

  async setupAdminEmail(adminId: string, email: string, newPassword: string): Promise<{ success: boolean; totpSecret?: string; qrCode?: string }> {
    try {
      // Generate TOTP secret
      const totpSecret = speakeasy.generateSecret({
        name: `QRFun Admin (${email})`,
        issuer: 'QRFun Games'
      });

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update admin record
      await db.update(admins)
        .set({
          email: email,
          passwordHash: hashedPassword,
          totpSecret: totpSecret.base32,
          isInitialSetup: false,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(admins.id, adminId));

      // Generate QR code for Google Authenticator
      const qrCode = await QRCode.toDataURL(totpSecret.otpauth_url!);

      return {
        success: true,
        totpSecret: totpSecret.base32,
        qrCode: qrCode
      };
    } catch (error) {
      console.error('Error in setupAdminEmail:', error);
      return { success: false };
    }
  }

  async validateLogin(username: string, password: string, totpCode: string): Promise<{ success: boolean; admin?: any; sessionToken?: string }> {
    try {
      const admin = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
      
      if (admin.length === 0 || admin[0].isInitialSetup) {
        return { success: false };
      }

      const adminData = admin[0];

      // Validate password
      if (!adminData.passwordHash || !await bcrypt.compare(password, adminData.passwordHash)) {
        return { success: false };
      }

      // Validate TOTP
      if (!adminData.totpSecret) {
        return { success: false };
      }

      const totpValid = speakeasy.totp.verify({
        secret: adminData.totpSecret,
        encoding: 'base32',
        token: totpCode,
        window: 1
      });

      if (!totpValid) {
        return { success: false };
      }

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.insert(adminSessions).values({
        adminId: adminData.id,
        sessionToken: sessionToken,
        expiresAt: expiresAt,
      });

      // Update last login
      await db.update(admins)
        .set({ lastLogin: new Date() })
        .where(eq(admins.id, adminData.id));

      return {
        success: true,
        admin: adminData,
        sessionToken: sessionToken
      };
    } catch (error) {
      console.error('Error in validateLogin:', error);
      return { success: false };
    }
  }

  async generatePasswordResetToken(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const admin = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
      
      if (admin.length === 0) {
        // Don't reveal if email exists
        return { success: true, message: 'If the email exists, a reset link has been sent.' };
      }

      const adminData = admin[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await db.insert(passwordResetTokens).values({
        adminId: adminData.id,
        token: resetToken,
        expiresAt: expiresAt,
        used: false,
      });

      // Send reset email
      await this.sendResetEmail(email, resetToken);

      return { success: true, message: 'If the email exists, a reset link has been sent.' };
    } catch (error) {
      console.error('Error in generatePasswordResetToken:', error);
      return { success: false, message: 'Error processing request.' };
    }
  }

  async validatePasswordReset(token: string, newPassword: string, totpCode: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find valid token
      const resetToken = await db.select({
        token: passwordResetTokens,
        admin: admins
      })
      .from(passwordResetTokens)
      .innerJoin(admins, eq(passwordResetTokens.adminId, admins.id))
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false)
        )
      )
      .limit(1);

      if (resetToken.length === 0) {
        return { success: false, message: 'Invalid or expired reset token.' };
      }

      const tokenData = resetToken[0].token;
      const adminData = resetToken[0].admin;

      // Check expiration
      if (new Date() > tokenData.expiresAt) {
        return { success: false, message: 'Reset token has expired.' };
      }

      // Validate TOTP - required even for password reset
      if (!adminData.totpSecret) {
        return { success: false, message: 'Two-factor authentication not set up.' };
      }

      const totpValid = speakeasy.totp.verify({
        secret: adminData.totpSecret,
        encoding: 'base32',
        token: totpCode,
        window: 1
      });

      if (!totpValid) {
        return { success: false, message: 'Invalid two-factor authentication code.' };
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      await db.update(admins)
        .set({
          passwordHash: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(admins.id, adminData.id));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, tokenData.id));

      return { success: true, message: 'Password reset successfully.' };
    } catch (error) {
      console.error('Error in validatePasswordReset:', error);
      return { success: false, message: 'Error processing password reset.' };
    }
  }

  async validateSession(sessionToken: string): Promise<{ success: boolean; admin?: any }> {
    try {
      const session = await db.select({
        session: adminSessions,
        admin: admins
      })
      .from(adminSessions)
      .innerJoin(admins, eq(adminSessions.adminId, admins.id))
      .where(eq(adminSessions.sessionToken, sessionToken))
      .limit(1);

      if (session.length === 0) {
        return { success: false };
      }

      const sessionData = session[0].session;
      const adminData = session[0].admin;

      // Check expiration
      if (new Date() > sessionData.expiresAt) {
        // Clean up expired session
        await db.delete(adminSessions).where(eq(adminSessions.id, sessionData.id));
        return { success: false };
      }

      return { success: true, admin: adminData };
    } catch (error) {
      console.error('Error in validateSession:', error);
      return { success: false };
    }
  }

  async sendResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/man/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.GMAIL_USER || 'noreply@gmail.com',
      to: email,
      subject: 'QRFun Admin - Password Reset',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your QRFun Admin account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}" target="_blank">Reset Password</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p><strong>Important:</strong> You will need your Google Authenticator code to complete the password reset.</p>
        <p>If you did not request this reset, please ignore this email.</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending reset email:', error);
      throw error;
    }
  }
}

export const adminAuthService = new AdminAuthServiceImpl();