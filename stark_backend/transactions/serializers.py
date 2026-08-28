# transactions/serializers.py - CLEANED UP VERSION
from rest_framework import serializers
from .models import Transaction
from wallets.models import Wallet
import re


class TransactionListSerializer(serializers.ListSerializer):
    """Prefetch commission source transactions once for a list response."""

    def to_representation(self, data):
        items = list(data)
        source_ids = set()
        for item in items:
            note = item.note or ""
            if "commission" not in note.lower():
                continue
            match = re.search(r"(?:order)?\s*(\d+)", note)
            if match:
                source_ids.add(int(match.group(1)))
        if source_ids:
            self.child._commission_source_by_id.update(
                Transaction.objects.filter(id__in=source_ids).select_related("user").in_bulk()
            )
        return super().to_representation(items)

class TransactionSerializer(serializers.ModelSerializer):
    amount = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    recipient_phone = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()
    wallet_currency = serializers.SerializerMethodField()
    commission_source_tx_id = serializers.SerializerMethodField()
    commission_source_user_name = serializers.SerializerMethodField()
    commission_source_note = serializers.SerializerMethodField()
    commission_source_product_name = serializers.SerializerMethodField()
    commission_source_created_at = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._commission_source_cache = {}
        self._commission_source_by_id = {}

    def get_amount(self, obj):
        return abs(obj.amount) if obj.amount is not None else obj.amount

    def get_sender_name(self, obj):
        sender = obj.related_transaction.user if obj.amount > 0 and obj.related_transaction else obj.user
        if not sender:
            return None
        return getattr(sender, "full_name", None) or getattr(sender, "name", None)

    def get_recipient_name(self, obj):
        if obj.recipient:
            return getattr(obj.recipient, "full_name", None) or getattr(obj.recipient, "name", None)
        return None

    def get_recipient_phone(self, obj):
        if obj.recipient:
            return getattr(obj.recipient, "phone", None)
        return None

    def get_direction(self, obj):
        return "in" if obj.amount > 0 else "out"

    def get_wallet_currency(self, obj):
        try:
            return obj.wallet.currency if obj.wallet else None
        except Exception:
            return None

    def _get_commission_source_tx(self, obj):
        if obj.pk in self._commission_source_cache:
            return self._commission_source_cache[obj.pk]
        try:
            note = obj.note or ""
            if "عمولة" not in note and "commission" not in note.lower():
                return None
            m = re.search(r"(?:طلب|order)?\\s*(\\d+)", note)
            if not m:
                return None
            tx_id = int(m.group(1))
            source = self._commission_source_by_id.get(tx_id)
            if source is None:
                source = Transaction.objects.filter(id=tx_id).select_related("user").first()
            self._commission_source_cache[obj.pk] = source
            return source
        except Exception:
            self._commission_source_cache[obj.pk] = None
            return None

    def get_commission_source_tx_id(self, obj):
        tx = self._get_commission_source_tx(obj)
        return tx.id if tx else None

    def get_commission_source_user_name(self, obj):
        tx = self._get_commission_source_tx(obj)
        if not tx or not tx.user:
            return None
        return getattr(tx.user, "full_name", None) or getattr(tx.user, "name", None)

    def get_commission_source_note(self, obj):
        tx = self._get_commission_source_tx(obj)
        return tx.note if tx else None

    def get_commission_source_product_name(self, obj):
        tx = self._get_commission_source_tx(obj)
        if not tx or not tx.note:
            return None
        note = tx.note
        m = re.search(r"Purchase:\\s*(.+)$", note, re.IGNORECASE)
        if m:
            return m.group(1).strip()
        m = re.search(r"شراء\\s*(.+)$", note)
        if m:
            return m.group(1).strip()
        return None

    def get_commission_source_created_at(self, obj):
        tx = self._get_commission_source_tx(obj)
        return tx.created_at if tx else None

    class Meta:
        model = Transaction
        list_serializer_class = TransactionListSerializer
        fields = [
            "id", "user", "wallet", "wallet_currency",
            "transaction_type", "currency", "amount", "amount_usd", "amount_syp", "exchange_rate_used",
            "exchange_rate_quote", "exchange_rate_side", "source_amount", "source_currency",
            "target_amount", "target_currency", "rounding_mode", "operation_context", "status", "note",
            "created_at", "recipient_wallet", "recipient", "sender_name", "recipient_name", "recipient_phone", "direction",
            "commission_source_tx_id", "commission_source_user_name", "commission_source_note",
            "commission_source_product_name", "commission_source_created_at"
        ]
        read_only_fields = ["id", "status", "created_at"]

class CreateTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ["wallet", "transaction_type", "amount", "note"]

    def validate(self, attrs):
        wallet = attrs.get("wallet")
        amount = attrs.get("amount")
        transaction_type = attrs.get("transaction_type")
        
        if transaction_type == "purchase" and wallet.balance < amount:
            raise serializers.ValidationError("Insufficient balance")
        return attrs
