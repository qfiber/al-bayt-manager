ALTER TABLE "apartments" ADD COLUMN "apartment_type" varchar(20) NOT NULL DEFAULT 'regular';
ALTER TABLE "apartments" ADD COLUMN "parent_apartment_id" uuid REFERENCES "apartments"("id") ON DELETE RESTRICT;
