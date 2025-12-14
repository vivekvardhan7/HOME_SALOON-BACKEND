-- Seed Service Categories
INSERT INTO public.service_categories (name, description, is_active)
VALUES 
  ('Haircut', 'Professional hair cutting services', true),
  ('Hair Spa', 'Relaxing hair spa treatments', true),
  ('Beard Trim', 'Beard trimming and grooming', true),
  ('Hair Color', 'Hair coloring and highlights', true),
  ('Facial Treatment', 'Rejuvenating facial treatments', true),
  ('Bridal Makeup', 'Professional bridal makeup services', true),
  ('Pedicure', 'Foot care and pedicure services', true),
  ('Manicure', 'Hand care and manicure services', true),
  ('Massage Therapy', 'Therapeutic massage services', true),
  ('Skin Care', 'Advanced skin care treatments', true),
  ('Waxing', 'Hair removal waxing services', true),
  ('Party Makeup', 'Makeup for parties and events', true),
  ('Kids Hair Services', 'Hair services for children', true),
  ('Grooming Packages', 'Complete grooming packages', true),
  ('Hair Styling', 'Hair styling and setting', true),
  ('Threading', 'Eyebrow and face threading', true),
  ('Hair Straightening', 'Permanent and temporary hair straightening', true),
  ('Hair Keratin', 'Keratin hair treatments', true),
  ('Mehndi / Henna', 'Traditional Mehndi and Henna application', true),
  ('Eyebrow Services', 'Eyebrow shaping and tinting', true)
ON CONFLICT (name) DO UPDATE SET 
  is_active = excluded.is_active;

-- Ensure public access
GRANT SELECT ON public.service_categories TO anon, authenticated, service_role;
