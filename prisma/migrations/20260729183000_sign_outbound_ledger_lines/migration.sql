-- The seed wrote quantity_base as an unsigned magnitude and kept the direction in
-- movements.type, so reading the ledger meant re-deriving the sign with a CASE and
-- an adjustment had no way to correct downwards at all.
--
-- quantity_base is signed from here on: SUM(quantity_base) is the stock on hand,
-- with nothing to remember. This flips the outbound lines already written.
UPDATE movement_items mi
SET quantity_base = -mi.quantity_base
FROM movements m
WHERE m.id = mi.movement_id
  AND m.type = 'OUTBOUND'
  AND mi.quantity_base > 0;
