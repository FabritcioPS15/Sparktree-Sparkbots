import express from 'express';
import { supabase } from '../../core/config/supabase';
import { auditLogService } from '../audit/auditLogService';

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function logToDebug(msg: string) {
  fs.appendFileSync(path.join(__dirname, '../../debug_requests.log'), `[AUTH DEBUG] ${new Date().toISOString()} ${msg}\n`);
}

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  console.log('[Auth Route] Login attempt for email:', req.body?.email);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*, organizations(name)')
      .eq('email', email)
      .single();

    if (error || !user) {
      logToDebug(`User lookup failed for ${email}: ${error?.message || 'NOT_FOUND'}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logToDebug(`User found: ${user.email}. Hash: ${user.password_hash}`);

    // Verify password with bcrypt
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      logToDebug(`Bcrypt check FAILED for ${email}. Comparing with raw password...`);
      // Fallback for simple dev passwords if not a hash
      if (user.password_hash === password) {
        logToDebug(`Literal match found for ${email}. Proceeding...`);
        // Allow it for now if they didn't run the migration correctly with hashes
      } else {
        logToDebug(`Literal match also FAILED for ${email}. Access denied.`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      logToDebug(`Bcrypt check SUCCESS for ${email}.`);
    }

    // Return user data (excluding password)
    const { password_hash, ...userWithoutPassword } = user;
    const userWithFullName = {
      ...userWithoutPassword,
      full_name: user.name || user.full_name || null
    };
    
    res.json({
      user: userWithFullName,
      organizationId: user.organization_id
    });

    // Auditoría (no bloqueante, tras respuesta)
    auditLogService.log({
      organizationId: user.organization_id,
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      resourceType: 'auth',
      details: `Inicio de sesión de ${user.email}`,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'localhost'
    });
  } catch (error: any) {
    console.error('[Auth Login] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  console.log('[Auth Route] Registration attempt for email:', req.body?.email);
  try {
    const { email, password, name, organizationName } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create organization if provided
    let organizationId = null;
    if (organizationName) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: organizationName })
        .select('id')
        .single();

      if (!orgError && org) {
        organizationId = org.id;
      }
    }

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        name,
        organization_id: organizationId,
        role: organizationId ? 'admin' : 'user'
      })
      .select('*, organizations(name)')
      .single();

    if (userError) {
      console.error('[Auth Register] Error creating user:', userError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Return user data (excluding password)
    const { password_hash: _, ...userWithoutPassword } = user;
    const userWithFullName = {
      ...userWithoutPassword,
      full_name: user.name || user.full_name || null
    };
    
    res.status(201).json({
      user: userWithFullName,
      organizationId: user.organization_id
    });
  } catch (error: any) {
    console.error('[Auth Register] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/recover-password
router.post('/recover-password', async (req, res) => {
  console.log('[Auth Route] Password recovery attempt for email:', req.body?.email);
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .single();

    if (error || !user) {
      // Don't reveal if email exists for security
      return res.json({ message: 'If the email exists, a recovery link will be sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in user record
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Auth Recover] Error storing reset token:', updateError);
      return res.status(500).json({ error: 'Failed to process recovery request' });
    }

    // In production, you would send an email here
    // For now, we'll log the token for development
    console.log(`[Auth Recover] Password reset token for ${email}: ${resetToken}`);
    console.log(`[Auth Recover] Reset link: http://localhost:5173/reset-password?token=${resetToken}`);

    res.json({ 
      message: 'If the email exists, a recovery link will be sent',
      devToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error: any) {
    console.error('[Auth Recover] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  console.log('[Auth Route] Password reset attempt');
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Find user with valid reset token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token is expired
    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash,
        reset_token: null,
        reset_token_expiry: null
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Auth Reset] Error updating password:', updateError);
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('[Auth Reset] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/admin-login (Single-click admin login for local development)
router.post('/admin-login', async (req, res) => {
  console.log('[Auth Route] Admin login attempt (single-click)');
  try {
    // Check if this is a development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Admin quick login is only available in development' });
    }

    // Look for or create a local admin user
    const adminEmail = 'admin@localhost';
    
    let { data: adminUser, error } = await supabase
      .from('users')
      .select('*, organizations(name)')
      .eq('email', adminEmail)
      .single();

    if (error || !adminUser) {
      // Create admin user if it doesn't exist
      const password_hash = await bcrypt.hash('admin123', 10);
      
      // Create organization for admin
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: 'Local Development' })
        .select('id')
        .single();

      const organizationId = orgError ? null : org?.id;

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: adminEmail,
          password_hash,
          name: 'Local Admin',
          organization_id: organizationId,
          role: 'admin'
        })
        .select('*, organizations(name)')
        .single();

      if (createError) {
        console.error('[Auth Admin Login] Error creating admin user:', createError);
        return res.status(500).json({ error: 'Failed to create admin user' });
      }

      adminUser = newUser;
    }

    // Return user data (excluding password)
    const { password_hash, ...userWithoutPassword } = adminUser;
    const userWithFullName = {
      ...userWithoutPassword,
      full_name: adminUser.name || adminUser.full_name || null
    };
    
    res.json({
      user: userWithFullName,
      organizationId: adminUser.organization_id
    });
  } catch (error: any) {
    console.error('[Auth Admin Login] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Since we rely on frontend session management for now, just return success
  res.json({ success: true });
});

export default router;
