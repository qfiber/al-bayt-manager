-- Add underground floors column to buildings
ALTER TABLE public.buildings 
ADD COLUMN underground_floors INTEGER DEFAULT 0;