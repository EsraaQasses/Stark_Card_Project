"""
Background task handlers for API operations.
Prevents blocking the main request thread during slow API calls.
"""

import logging
import threading
import queue
import os
import time
from typing import Dict, Any, Callable
from django.db import connection
from django.core.mail import send_mail
from django.conf import settings
from .models import APITransaction, ThirdPartyAPI
from transactions.models import Transaction
from wallets.models import Wallet

logger = logging.getLogger(__name__)

# Global task queue
_task_queue = queue.Queue()
_worker_thread = None
_pending_poll_thread = None
_pending_poll_lock = threading.Lock()


def _get_audit_logger():
    """File audit logger for pending purchase polling."""
    log_name = "pending_purchases_audit"
    audit_logger = logging.getLogger(log_name)
    if audit_logger.handlers:
        return audit_logger

    log_path = os.getenv("PENDING_PURCHASE_LOG_FILE")
    if not log_path:
        log_path = os.path.join(str(settings.BASE_DIR), "pending_purchases.log")

    audit_logger.setLevel(logging.INFO)
    handler = logging.FileHandler(log_path)
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s"
    )
    handler.setFormatter(formatter)
    audit_logger.addHandler(handler)
    audit_logger.propagate = False
    return audit_logger


def _task_worker():
    """Background worker that processes tasks from the queue."""
    while True:
        try:
            task_func, args, kwargs = _task_queue.get()
            
            # Close old connections before processing long-running tasks
            connection.close()
            
            try:
                task_func(*args, **kwargs)
            except Exception as e:
                logger.error(f"Task execution error: {e}", exc_info=True)
            finally:
                _task_queue.task_done()
        except Exception as e:
            logger.error(f"Worker thread error: {e}", exc_info=True)


def start_background_worker():
    """Start the background worker thread (call once at app startup)."""
    global _worker_thread
    if _worker_thread is None or not _worker_thread.is_alive():
        _worker_thread = threading.Thread(target=_task_worker, daemon=True)
        _worker_thread.start()
        logger.info("Background worker thread started")


def queue_task(task_func: Callable, *args, **kwargs):
    """Queue a task to be executed in the background."""
    _task_queue.put((task_func, args, kwargs))


def _poll_pending_purchases_once():
    """Check pending purchases and update status."""
    from third_party_apis.services.api_service import APIService

    audit_logger = _get_audit_logger()
    try:
        pending_qs = APITransaction.objects.filter(
            endpoint_used="/api/purchase",
            internal_transaction__status="pending",
        ).select_related("api_config", "internal_transaction")

        checked = 0
        updated = 0
        for api_tx in pending_qs:
            checked += 1
            external_order_id = api_tx.external_transaction_id
            if not external_order_id and isinstance(api_tx.response_payload, dict):
                external_order_id = (
                    api_tx.response_payload.get("local_id")
                    or api_tx.response_payload.get("order_uuid")
                )
            if not external_order_id:
                continue

            result = APIService.update_order_status(api_tx.api_config_id, external_order_id)
            if result.get("success"):
                updated += 1
                audit_logger.info(
                    "tx=%s provider=%s external=%s status=%s raw=%s",
                    api_tx.internal_transaction_id,
                    api_tx.api_config.provider,
                    external_order_id,
                    result.get("status"),
                    result.get("raw_status"),
                )
            else:
                audit_logger.warning(
                    "tx=%s provider=%s external=%s error=%s",
                    api_tx.internal_transaction_id,
                    api_tx.api_config.provider,
                    external_order_id,
                    result.get("error"),
                )

        audit_logger.info("poll_done checked=%s updated=%s", checked, updated)
    except Exception as exc:
        audit_logger.error("poll_failed error=%s", exc)


def _pending_purchase_poll_loop(interval_minutes: int):
    """Background loop to poll pending purchases."""
    audit_logger = _get_audit_logger()
    audit_logger.info("pending_poll_started interval_minutes=%s", interval_minutes)
    while True:
        try:
            # Close old connections before long-running tasks
            connection.close()
        except Exception:
            pass
        _poll_pending_purchases_once()
        time.sleep(max(interval_minutes, 1) * 60)


def start_pending_purchase_scheduler():
    """Start background scheduler for pending purchase polling."""
    global _pending_poll_thread
    enabled = os.getenv("PENDING_PURCHASE_POLL_ENABLED", "true").lower() in ("1", "true", "yes")
    if not enabled:
        logger.info("Pending purchase polling disabled by env")
        return

    try:
        interval = int(os.getenv("PENDING_PURCHASE_POLL_MINUTES", "5"))
    except Exception:
        interval = 5

    with _pending_poll_lock:
        if _pending_poll_thread is None or not _pending_poll_thread.is_alive():
            _pending_poll_thread = threading.Thread(
                target=_pending_purchase_poll_loop,
                args=(interval,),
                daemon=True,
            )
            _pending_poll_thread.start()
            logger.info("Pending purchase polling thread started")


def notify_purchase_completed(transaction_id: int, success: bool, error_msg: str = None):
    """Task: Notify user of purchase completion (for future webhook integration)."""
    try:
        transaction = Transaction.objects.get(id=transaction_id)
        user = transaction.user
        
        if success:
            subject = "Purchase Completed Successfully"
            message = f"Your purchase of {transaction.note} has been completed."
        else:
            subject = "Purchase Failed"
            message = f"Your purchase attempt failed: {error_msg}"
        
        # Send email notification (when email is configured)
        if user.email:
            try:
                send_mail(
                    subject,
                    message,
                    'noreply@stark-card.com',
                    [user.email],
                    fail_silently=True
                )
            except Exception as e:
                logger.warning(f"Failed to send email notification: {e}")
        
        logger.info(f"Purchase notification sent for transaction {transaction_id}")
        
    except Transaction.DoesNotExist:
        logger.warning(f"Transaction {transaction_id} not found for notification")
    except Exception as e:
        logger.error(f"Error in notify_purchase_completed: {e}")


def check_and_retry_failed_purchase(transaction_id: int):
    """Task: Check status and retry failed purchases (for order polling)."""
    try:
        transaction = Transaction.objects.select_related('user', 'wallet').get(id=transaction_id)
        
        if transaction.status == 'pending':
            # Query the API to check order status
            api_transaction = APITransaction.objects.filter(
                internal_transaction=transaction
            ).first()
            
            if api_transaction and api_transaction.external_transaction_id:
                # TODO: Implement order status check
                logger.info(f"Would check status for order {api_transaction.external_transaction_id}")
        
    except Transaction.DoesNotExist:
        logger.warning(f"Transaction {transaction_id} not found for retry check")
    except Exception as e:
        logger.error(f"Error in check_and_retry_failed_purchase: {e}")
