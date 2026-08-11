alter table public.stop_feedback
  rename column rating to overall_rating;

alter table public.stop_feedback
  add column cleanliness_rating smallint check (cleanliness_rating between 1 and 5),
  add column safety_rating smallint check (safety_rating between 1 and 5),
  add column accessibility_rating smallint check (accessibility_rating between 1 and 5),
  add column information_rating smallint check (information_rating between 1 and 5),
  add column shelter_rating smallint check (shelter_rating between 1 and 5),
  add column has_shelter boolean,
  add column has_seating boolean,
  add column has_lighting boolean,
  add column email text check (email is null or char_length(email) <= 320),
  add column consent_to_contact boolean not null default false;
