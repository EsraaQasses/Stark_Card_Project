from decimal import Decimal, ROUND_HALF_UP


MONEY_QUANTUM = Decimal("0.00000001")
RATE_QUANTUM = Decimal("0.000001")


def quantize_money(value) -> Decimal:
    return Decimal(str(value)).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def quantize_rate(value) -> Decimal:
    return Decimal(str(value)).quantize(RATE_QUANTUM, rounding=ROUND_HALF_UP)
