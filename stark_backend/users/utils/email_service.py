# users/utils/email_service.py - UPDATED VERSION
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

class EmailService:
    @staticmethod
    def send_secure_password_reset_code(user, code, minutes=10):
        """Send a reset code without logging the recipient, code, or password."""
        try:
            subject = f"Password reset code - {getattr(settings, 'APP_NAME', 'Stark')}"
            context = {
                "app_name": getattr(settings, "APP_NAME", "Stark"),
                "otp_code": code,
                "minutes": minutes,
                "year": timezone.now().year,
            }
            text_content = (
                f"{context['app_name']} password reset\n\n"
                f"Your verification code is: {context['otp_code']}\n"
                f"This code expires in {context['minutes']} minutes. Do not share it.\n"
            )
            html_content = (
                f"<p>{context['app_name']} password reset</p>"
                f"<p><strong>{context['otp_code']}</strong></p>"
                f"<p>This code expires in {context['minutes']} minutes. Do not share it.</p>"
            )
            email = EmailMultiAlternatives(subject, text_content, settings.DEFAULT_FROM_EMAIL, [user.email])
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
            return True
        except Exception:
            logger.exception("Password reset email delivery failed")
            return False

    @staticmethod
    def send_password_changed_notification(user):
        try:
            subject = f"Password changed - {getattr(settings, 'APP_NAME', 'Stark')}"
            body = "Your password was changed. If you did not make this change, contact support immediately."
            EmailMultiAlternatives(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email]).send(fail_silently=False)
            return True
        except Exception:
            logger.exception("Password changed notification delivery failed")
            return False

    @staticmethod
    def send_otp_email(user, otp_code, purpose='verification'):
        """Send OTP email for login or verification"""
        try:
            if purpose == 'login':
                subject = f"Login Verification - {getattr(settings, 'APP_NAME', 'Stark')}"
                greeting = "You are attempting to log in to your account."
            else:
                subject = f"Account Verification - {getattr(settings, 'APP_NAME', 'Stark')}"
                greeting = "Please verify your account."
            
            context = {
                'app_name': getattr(settings, 'APP_NAME', 'Stark'),
                'user_name': user.full_name or user.name,
                'otp_code': otp_code,
                'timestamp': timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
                'purpose': purpose,
                'support_email': getattr(settings, 'SUPPORT_EMAIL', 'support@stark.com')
            }
            
            # HTML content
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background-color: #4CAF50; color: white; padding: 20px; text-align: center; }}
                    .content {{ padding: 30px; background-color: #f9f9f9; }}
                    .otp-box {{ 
                        background-color: #fff; 
                        border: 2px dashed #4CAF50; 
                        padding: 20px; 
                        text-align: center; 
                        font-size: 32px; 
                        font-weight: bold; 
                        letter-spacing: 5px;
                        margin: 20px 0;
                    }}
                    .footer {{ background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px; }}
                    .warning {{ color: #ff9800; font-weight: bold; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>{'Login Verification' if purpose == 'login' else 'Account Verification'}</h1>
                    </div>
                    <div class="content">
                        <p>Hello <strong>{context['user_name']}</strong>,</p>
                        <p>{greeting} Use the OTP below to complete the process:</p>
                        
                        <div class="otp-box">
                            {otp_code}
                        </div>
                        
                        <p class="warning">⚠️ This OTP is valid for 5 minutes only.</p>
                        
                        <p>If you did not request this, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>© {timezone.now().year} {context['app_name']}. All rights reserved.</p>
                        <p>Contact: {context['support_email']}</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text content
            text_content = f"""
            {'Login Verification' if purpose == 'login' else 'Account Verification'}
            {'=' * (20 + len(purpose))}
            
            Hello {context['user_name']},
            
            {greeting}
            
            Your OTP: {otp_code}
            
            ⚠️ This OTP is valid for 5 minutes only.
            
            If you did not request this, please ignore this email.
            
            © {timezone.now().year} {context['app_name']}
            Contact: {context['support_email']}
            """
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email]
            )
            email.attach_alternative(html_content, "text/html")
            
            email.send(fail_silently=False)
            
            logger.info(f"OTP email sent to {user.email} for user {user.name} (purpose: {purpose})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send OTP email to {user.email}: {str(e)}")
            return False

    @staticmethod
    def send_admin_login_otp(user, otp_code, ip_address=None, user_agent=None):
        """Send OTP for admin login (Step 3)"""
        try:
            subject = f"Admin Login Verification - {getattr(settings, 'APP_NAME', 'Stark')}"
            
            context = {
                'app_name': getattr(settings, 'APP_NAME', 'Stark'),
                'user_name': user.full_name or user.name,
                'otp_code': otp_code,
                'timestamp': timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
                'ip_address': ip_address or 'Unknown',
                'user_agent': user_agent or 'Unknown',
                'support_email': getattr(settings, 'SUPPORT_EMAIL', 'support@stark.com')
            }
            
            # HTML content
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background-color: #4CAF50; color: white; padding: 20px; text-align: center; }}
                    .content {{ padding: 30px; background-color: #f9f9f9; }}
                    .otp-box {{ 
                        background-color: #fff; 
                        border: 2px dashed #4CAF50; 
                        padding: 20px; 
                        text-align: center; 
                        font-size: 32px; 
                        font-weight: bold; 
                        letter-spacing: 5px;
                        margin: 20px 0;
                    }}
                    .footer {{ background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px; }}
                    .warning {{ color: #ff9800; font-weight: bold; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Admin Login Verification</h1>
                    </div>
                    <div class="content">
                        <p>Hello <strong>{context['user_name']}</strong>,</p>
                        <p>You are attempting to log in to the admin panel. Use the OTP below to complete your login:</p>
                        
                        <div class="otp-box">
                            {otp_code}
                        </div>
                        
                        <p class="warning">⚠️ This OTP is valid for 5 minutes only.</p>
                        
                        <p><strong>Login Details:</strong></p>
                        <ul>
                            <li>Time: {context['timestamp']}</li>
                            <li>IP Address: {context['ip_address']}</li>
                            <li>Device: {context['user_agent'][:100]}</li>
                        </ul>
                        
                        <p>If you did not request this login, please secure your account immediately.</p>
                    </div>
                    <div class="footer">
                        <p>© {timezone.now().year} {context['app_name']}. All rights reserved.</p>
                        <p>Contact: {context['support_email']}</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text content
            text_content = f"""
            Admin Login Verification
            ========================
            
            Hello {context['user_name']},
            
            You are attempting to log in to the admin panel.
            
            Your OTP: {otp_code}
            
            ⚠️ This OTP is valid for 5 minutes only.
            
            Login Details:
            - Time: {context['timestamp']}
            - IP Address: {context['ip_address']}
            - Device: {context['user_agent'][:100]}
            
            If you did not request this login, please secure your account immediately.
            
            © {timezone.now().year} {context['app_name']}
            Contact: {context['support_email']}
            """
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email]
            )
            email.attach_alternative(html_content, "text/html")
            
            email.send(fail_silently=False)
            
            logger.info(f"Admin login OTP sent to {user.email} for user {user.name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send admin login OTP to {user.email}: {str(e)}")
            return False

    @staticmethod
    def send_password_reset_email(user, reset_link):
        """Send password reset email with HTML template."""
        try:
            subject = f"Reset Your Password - {getattr(settings, 'APP_NAME', 'Stark')}"
            context = {
                "app_name": getattr(settings, "APP_NAME", "Stark"),
                "user_name": user.full_name or user.name,
                "reset_link": reset_link,
                "support_email": getattr(settings, "SUPPORT_EMAIL", "support@stark.com"),
                "year": timezone.now().year,
            }

            html_content = render_to_string("emails/password_reset.html", context)
            text_content = strip_tags(html_content)

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)

            logger.info(f"Password reset email sent to {user.email} for user {user.name}")
            return True
        except Exception as e:
            logger.error(f"Failed to send password reset email to {user.email}: {str(e)}")
            return False

    @staticmethod
    def send_password_reset_code(user, code, minutes=5):
        """Send password reset OTP code."""
        try:
            subject = f"Reset Code - {getattr(settings, 'APP_NAME', 'Stark')}"
            context = {
                "app_name": getattr(settings, "APP_NAME", "Stark"),
                "user_name": user.full_name or user.name,
                "otp_code": code,
                "minutes": minutes,
                "support_email": getattr(settings, "SUPPORT_EMAIL", "support@stark.com"),
                "year": timezone.now().year,
            }

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Password Reset Code</title>
            </head>
            <body style="margin:0; padding:0; background:#f5f7fb; font-family:Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f7fb; padding:24px 0;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e6edf5;">
                      <tr>
                        <td style="background:#0b63d8; color:#ffffff; padding:22px 28px;">
                          <h1 style="margin:0; font-size:22px; font-weight:700;">{context['app_name']} Reset Code</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:28px;">
                          <p style="margin:0 0 12px 0; font-size:16px; color:#0b1220;">
                            Hello <strong>{context['user_name']}</strong>,
                          </p>
                          <p style="margin:0 0 18px 0; font-size:14px; color:#475569; line-height:1.6;">
                            Use the code below to reset your password.
                          </p>
                          <div style="background:#f8fafc; border:1px dashed #0b63d8; padding:16px; text-align:center; font-size:28px; font-weight:700; letter-spacing:4px;">
                            {context['otp_code']}
                          </div>
                          <p style="margin:16px 0 0 0; font-size:13px; color:#64748b;">
                            This code expires in {context['minutes']} minutes.
                          </p>
                          <p style="margin:10px 0 0 0; font-size:12px; color:#94a3b8;">
                            If you didn't request this, you can ignore this email.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#0b1220; color:#cbd5e1; padding:16px 28px; font-size:12px;">
                          <div>© {context['year']} {context['app_name']}. All rights reserved.</div>
                          <div>Support: {context['support_email']}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """

            text_content = strip_tags(html_content)
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
            return True
        except Exception as e:
            logger.error(f"Failed to send reset code to {user.email}: {str(e)}")
            return False
