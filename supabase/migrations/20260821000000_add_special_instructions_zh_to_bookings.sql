-- Simplified-Chinese machine translation of special_instructions, generated
-- server-side at booking time (see src/lib/translate/translate-to-chinese.ts).
-- Nullable: no note to translate, or the translation call failed — both are
-- fine, translation is best-effort and must never block a booking.
alter table public.bookings
  add column special_instructions_zh text;

-- No RLS policy changes needed: same insert-only exposure as
-- special_instructions itself, populated server-side alongside it.
