-- Add number_of_floors column to buildings table
ALTER TABLE public.buildings 
ADD COLUMN number_of_floors integer;

-- Add floor column to apartments table
ALTER TABLE public.apartments 
ADD COLUMN floor text;