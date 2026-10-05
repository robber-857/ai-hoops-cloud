"""Aggregate frozen training estimates without recalculating historical records."""
from decimal import Decimal, ROUND_HALF_UP, localcontext


def aggregate_exercise_energy(reports):
    attended = [report for report in reports if report['attendance'] != 'absent']
    known = []
    missing_items = 0
    missing_reports = 0
    methods = set()
    for report in attended:
        energy = report.get('exercise_energy')
        if not energy:
            # Older publications have no estimate; an unknown value is not zero.
            missing_reports += 1
            missing_items += sum(Decimal(item.get('minutes') or '0') > 0 for item in report.get('items', []))
            continue
        raw = energy.get('unrounded_subtotal_kcal')
        if raw is not None:
            known.append(Decimal(raw))
        missing_items += energy.get('missing_items', 0)
        if energy['status'] not in ('complete', 'not_applicable'):
            missing_reports += 1
        methods.update(energy.get('methods', []))
    with localcontext() as context:
        context.prec = 40
        subtotal = sum(known, Decimal(0)) if known else None
    complete = bool(attended) and missing_reports == 0
    status = ('not_applicable' if reports and not attended else
              'complete' if complete else 'partial' if known else 'unavailable')
    rounded = int(subtotal.quantize(Decimal('1'), rounding=ROUND_HALF_UP)) if subtotal is not None else None
    return dict(status=status, total_kcal=rounded if complete else None,
                known_subtotal_kcal=rounded, unrounded_subtotal_kcal=str(subtotal) if subtotal is not None else None,
                missing_items=missing_items, missing_reports=missing_reports,
                methods=sorted(methods), basis='gross')
